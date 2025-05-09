import {
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
export class CedarInputOrcidComponent extends CedarUIDirective implements OnInit {
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
  hasSearched = false;
  loadingDetails = false;

  filteredOptions: Observable<OrcidSearchResponseItem[]>;
  private researcherDetailsCache = new Map<string, ResearcherDetails>();
  justReverted: boolean;
  selectionInProgress = false;

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
        switchMap((val) => {
          const isSame = this.selectedData && val === this.getCompoundValue(this.selectedData);
          if (isSame) {
            this.loadingOptions = false;
            this.cdr.markForCheck();
            return of([this.selectedData]);
          }
          return this.filter(val || '').pipe(
            finalize(() => {
              this.loadingOptions = false;
              this.hasSearched = true;
              this.cdr.markForCheck();
            }),
          );
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
          this.researcherDetailsCache.set(response.id, details);
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
    if (!option) return;
    this.selectionInProgress = false;
    this.selectedData = option;

    const id = option[JsonSchema.atId];
    const rdfsLabel = option[JsonSchema.rdfsLabel];
    this.handlerContext.changeControlledValue(this.component, id, rdfsLabel);

    this.setCurrentValue(option);
  }
  inputChanged(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (!val?.trim()) {
      this.clearValue();
    } else {
      if (this.trigger && !this.trigger.panelOpen) {
        this.trigger.openPanel();
      }
      this.loadingOptions = true;
      this.hasSearched = false;
      this.cdr.markForCheck();
    }
  }
  onInputBlur(): void {
    if (this.selectionInProgress) return;
    this.loadingOptions = false;
    this.cdr.markForCheck();

    const raw = this.inputValueControl.getRawValue()?.trim();
    const current = this.getCompoundValue(this.selectedData);
    if (raw && raw !== current) {
      if (this.selectedData) {
        this.inputValueControl.setValue(current, { emitEvent: true });
        this.showRevertHint();
      } else {
        this.clearValue(true);
      }
      return;
    }
    if (!this.selectedData && raw) {
      this.showRevertHint();
      this.clearValue(true);
      return;
    }
    this.setCurrentValue(this.selectedData);
  }
  setCurrentValue(item: OrcidSearchResponseItem): void {
    const display = this.getCompoundValue(item);
    if (this.inputValueControl.value !== display) {
      this.inputValueControl.setValue(display, { emitEvent: false });
      this.selectedData = item;
    }
    this.getDetails();
  }
  private showRevertHint(): void {
    this.justReverted = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.justReverted = false;
      this.cdr.markForCheck();
    }, 5000);
  }
  clearValue(markError = false): void {
    this.selectedData = null;
    this.inputValueControl.setValue('', { emitEvent: true });
    if (markError) {
      this.inputValueControl.setErrors({ invalidOrcid: true });
      this.inputValueControl.markAsTouched();
    } else {
      this.inputValueControl.setErrors(null);
    }
    this.handlerContext.changeControlledValue(this.component, null, null);
  }
  private getDetails(): void {
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
          this.loadingDetails = false;
          this.cdr.markForCheck();
        }),
        catchError(() => {
          return of(null as never);
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
