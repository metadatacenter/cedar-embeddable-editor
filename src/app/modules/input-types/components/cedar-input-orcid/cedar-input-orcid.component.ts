import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ErrorStateMatcher } from '@angular/material/core';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, tap, catchError, finalize } from 'rxjs/operators';
import { JsonSchema } from '../../../shared/models/json-schema.model';
import { OrcidFieldDataService } from '../../../shared/service/orcid-field-data.service';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { OrcidSearchResponseItem } from '../../../shared/models/rest/orcid-search/orcid-search-response-item';
import { ResearcherDetails } from '../../../shared/models/rest/orcid-detail/orcid-detail-person';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-cedar-input-orcid',
  templateUrl: './cedar-input-orcid.component.html',
  styleUrls: ['./cedar-input-orcid.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CedarInputOrcidComponent extends CedarUIDirective implements OnInit, AfterViewInit {
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger })
  trigger: MatAutocompleteTrigger;

  selectedData: OrcidSearchResponseItem;
  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  @Input() handlerContext: HandlerContext;
  model: OrcidSearchResponseItem = null;
  researcherDetails: ResearcherDetails = null;
  showDetails = false;

  loadingOptions = false;
  loadingDetails = false;

  filteredOptions: Observable<OrcidSearchResponseItem[]>;
  private researcherDetailsCache = new Map<string, ResearcherDetails>();

  constructor(
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private orcidFieldDataService: OrcidFieldDataService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  ngOnInit(): void {
    super.ngOnInit();
    const validators = [];

    if (this.component?.valueInfo?.requiredValue) {
      validators.push(Validators.required);
    }
    this.inputValueControl = new FormControl(null, validators);

    if (this.component?.valueInfo?.defaultValue) {
      const defaultAtId = this.component.valueInfo.defaultValue[JsonSchema.atId] || null;
      const defaultLabel = this.component.valueInfo.defaultValue[JsonSchema.rdfsLabel] || null;
      this.updateValue(defaultAtId, defaultLabel);
    }

    if (!this.readOnlyMode) {
      this.filteredOptions = this.inputValueControl.valueChanges.pipe(
        debounceTime(500),
        distinctUntilChanged(),
        tap(() => (this.loadingOptions = true)),

        switchMap((val: string) => {
          if (this.selectedData && val === this.getCompoundValue(this.selectedData)) {
            this.loadingOptions = false;
            return of([this.selectedData]);
          }
          return this.filter(val || '').pipe(finalize(() => (this.loadingOptions = false)));
        }),
        tap(() => {
          setTimeout(() => {
            const panel = document.querySelector('.mat-autocomplete-panel') as HTMLElement;
            if (panel) panel.scrollTop = 0;
          });
        }),
      );
    }
  }
  ngAfterViewInit(): void {
    if (!this.readOnlyMode && this.trigger) {
      this.trigger.panelClosingActions.subscribe(() => {
        if (!this.selectedData && this.inputValueControl.getRawValue()) {
          this.clearValue();
          this.inputValueControl.setErrors({ invalidOrcid: true });
        } else {
          this.setCurrentValue(this.selectedData);
          if (this.inputValueControl.errors && this.inputValueControl.errors.invalidOrcid) {
            const errors = { ...this.inputValueControl.errors };
            delete errors.invalidOrcid;
            this.inputValueControl.setErrors(Object.keys(errors).length > 0 ? errors : null);
          }
        }
      });
    }
  }
  private getCompoundValue(option: OrcidSearchResponseItem): string {
    if (!option) {
      return '';
    }
    const label = option[JsonSchema.rdfsLabel] ? option[JsonSchema.rdfsLabel].trim() : '';
    const id = option[JsonSchema.atId] ? option[JsonSchema.atId].trim() : '';
    return `${label} - ${id}`;
  }

  private filter(val: string): Observable<OrcidSearchResponseItem[]> {
    if (!val) {
      return of([]);
    }
    if (/^(http|0|orcid\.org)/i.test(val)) {
      return this.orcidFieldDataService.getDetails(val).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          }
          const details = ResearcherDetails.fromJson(response);
          const item: OrcidSearchResponseItem = {
            [JsonSchema.atId]: response.id,
            [JsonSchema.rdfsLabel]: response.name,
            researcherDetails: details,
          };
          return [item];
        }),
        catchError((error) => {
          console.error('Error in getDetails:', error);
          return of([]);
        }),
      );
    } else {
      return this.orcidFieldDataService.getData(val).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          }
          return response.results;
        }),
        catchError((error) => {
          console.error('Error in getData:', error);
          return of([]);
        }),
      );
    }
  }
  private updateValue(atId: string, prefLabel: string): void {
    if (!prefLabel) {
      return;
    }
    this.inputValueControl.setValue(prefLabel, { emitEvent: false });
    this.handlerContext.changeControlledValue(this.component, atId, prefLabel);
  }
  onSelectionChange(option: OrcidSearchResponseItem): void {
    if (!option) {
      return;
    }
    const id = option[JsonSchema.atId];
    const rdfsLabel = option[JsonSchema.rdfsLabel];
    this.selectedData = option;
    if (option.researcherDetails) {
      this.researcherDetails = option.researcherDetails;
    } else {
      this.getDetails();
    }
    this.handlerContext.changeControlledValue(this.component, id, rdfsLabel);
    this.setCurrentValue(option);
  }
  inputChanged(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    if (!target?.value?.trim()) {
      this.clearValue();
    }
  }
  setCurrentValue(item: OrcidSearchResponseItem): void {
    const display = this.getCompoundValue(item);
    if (this.inputValueControl.value !== display) {
      this.inputValueControl.setValue(display, { emitEvent: false });
      this.selectedData = item;
    }
    this.getDetails();
  }
  clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue(null, { emitEvent: false });
    this.handlerContext.changeControlledValue(this.component, null, null);
  }
  private getDetails(): void {
    console.log('In get details');
    if (!this.selectedData || !this.selectedData[JsonSchema.atId]) {
      console.warn('No valid selected data to retrieve details.');
      return;
    }
    const selectedId = this.selectedData[JsonSchema.atId];
    if (this.researcherDetailsCache.has(selectedId)) {
      this.researcherDetails = this.researcherDetailsCache.get(selectedId);
      return;
    }
    this.loadingDetails = true;
    this.cdr.markForCheck();
    this.orcidFieldDataService
      .getDetails(selectedId)
      .pipe(
        finalize(() => {
          console.log('Finalizing');
          this.loadingDetails = false;
          this.cdr.markForCheck();
        }),
        catchError((error) => {
          console.error('Error retrieving details:', error);
          return of(null as any);
        }),
      )
      .subscribe((response: ResearcherDetails) => {
        if (response && response.found) {
          this.researcherDetails = ResearcherDetails.fromJson(response);
          this.researcherDetailsCache.set(selectedId, this.researcherDetails);
          this.cdr.markForCheck();
        }
      });
  }
  setShowDetails = (setValue: boolean): void => {
    this.showDetails = setValue;
  };
  protected readonly JsonSchema = JsonSchema;
}
