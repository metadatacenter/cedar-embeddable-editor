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
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { ErrorStateMatcher } from '@angular/material/core';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, finalize, catchError, map } from 'rxjs/operators';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { OrcidFieldDataService } from '../../../shared/service/orcid-field-data.service';
import { JsonSchema } from '../../../shared/models/json-schema.model';
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
  component: FieldComponent;
  @ViewChild('autoCompleteInput', { read: MatAutocompleteTrigger })
  trigger: MatAutocompleteTrigger;
  @Input() handlerContext: HandlerContext;
  @Input() set componentToRender(component: FieldComponent) {
    this.component = component;
    this.activeComponentRegistry.registerComponent(component, this);
  }
  options: FormGroup;
  inputValueControl = new FormControl(null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  selectedData: OrcidSearchResponseItem;
  researcherDetails: ResearcherDetails;
  showDetails = false;
  loadingOptions = false;
  hasSearched = false;
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
    this.options = fb.group({ inputValue: this.inputValueControl });
  }
  ngOnInit(): void {
    super.ngOnInit();
    const validators = this.component?.valueInfo?.requiredValue ? [Validators.required] : [];
    this.inputValueControl = new FormControl(null, validators);
    const defaultValue = this.component?.valueInfo?.defaultValue;
    if (defaultValue) {
      const id = defaultValue[JsonSchema.atId] || '';
      const label = defaultValue[JsonSchema.rdfsLabel] || '';
      this.setDefaultValue(id, label);
    }
    if (!this.readOnlyMode) {
      this.setupAutocomplete();
    }
  }
  ngAfterViewInit(): void {
    if (this.trigger) {
      this.trigger.panelClosingActions.subscribe(() => this.onPanelClose());
    }
  }
  inputChanged(event: Event): void {
    const val = (event.target as HTMLInputElement).value.trim();
    if (!val) {
      this.clearValue();
      return;
    }
    if (!this.trigger.panelOpen) this.trigger.openPanel();
    this.loadingOptions = true;
    this.hasSearched = false;
    this.cdr.markForCheck();
  }
  onSelectionChange(option: OrcidSearchResponseItem): void {
    if (!option) return;
    this.selectedData = option;
    this.researcherDetails = option.researcherDetails;
    const id = option[JsonSchema.atId];
    const label = option[JsonSchema.rdfsLabel];
    this.handlerContext.changeControlledValue(this.component, id, label);
    this.setCurrentValue(option);
    this.getDetails();
  }
  setShowDetails = (visible: boolean): void => {
    this.showDetails = visible;
  };
  private setupAutocomplete(): void {
    this.filteredOptions = this.inputValueControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap((val) => this.getOptions(val)),
      tap(() => this.scrollPanelTop()),
    );
  }
  private getOptions(val: string): Observable<OrcidSearchResponseItem[]> {
    const display = this.getCompoundValue(this.selectedData);
    if (this.selectedData && val === display) {
      this.loadingOptions = false;
      this.hasSearched = true;
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
  }
  private onPanelClose(): void {
    const raw = this.inputValueControl.getRawValue();
    if (!this.selectedData && raw) {
      this.clearValue();
      this.inputValueControl.setErrors({ invalidOrcid: true });
    } else {
      this.setCurrentValue(this.selectedData);
    }
  }
  private setDefaultValue(id: string, label: string): void {
    const item: OrcidSearchResponseItem = {
      [JsonSchema.atId]: id,
      [JsonSchema.rdfsLabel]: label,
    } as any;
    this.selectedData = item;
    this.setCurrentValue(item);
  }
  public setCurrentValue(item: OrcidSearchResponseItem): void {
    const display = this.getCompoundValue(item);
    if (this.inputValueControl.value !== display) {
      this.inputValueControl.setValue(display, { emitEvent: false });
      this.selectedData = item;
    }
  }
  private clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue('', { emitEvent: true });
    this.handlerContext.changeControlledValue(this.component, null, null);
  }
  private getCompoundValue(item: OrcidSearchResponseItem): string {
    const label = (item?.[JsonSchema.rdfsLabel] || '').trim();
    const id = (item?.[JsonSchema.atId] || '').trim();
    return label && id ? `${label} - ${id}` : label;
  }
  private filter(val: string): Observable<OrcidSearchResponseItem[]> {
    if (!val) return of([]);
    return /^(?:http|0|orcid\.org)/i.test(val) ? this.fetchDetails(val) : this.fetchSearch(val);
  }
  private fetchDetails(val: string) {
    return this.orcidFieldDataService.getDetails(val).pipe(
      catchError(() => of(null as any)),
      map((resp) => {
        if (!resp?.found) return [];
        const details = ResearcherDetails.fromJson(resp);
        return [
          {
            [JsonSchema.atId]: resp.id,
            [JsonSchema.rdfsLabel]: resp.name,
            researcherDetails: details,
          } as OrcidSearchResponseItem,
        ];
      }),
    );
  }
  private fetchSearch(val: string) {
    return this.orcidFieldDataService.getData(val).pipe(
      map((resp) => (resp?.found ? resp.results : [])),
      catchError(() => of([])),
    );
  }
  private getDetails(): void {
    const id = this.selectedData?.[JsonSchema.atId];
    if (!id) return;
    if (this.researcherDetailsCache.has(id)) {
      this.researcherDetails = this.researcherDetailsCache.get(id)!;
      return;
    }
    this.loadingDetails = true;
    this.cdr.markForCheck();
    this.orcidFieldDataService
      .getDetails(id)
      .pipe(
        catchError(() => of(null as any)),
        finalize(() => {
          this.loadingDetails = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((resp) => {
        if (resp?.found) {
          const details = ResearcherDetails.fromJson(resp);
          this.researcherDetails = details;
          this.researcherDetailsCache.set(id, details);
          this.cdr.markForCheck();
        }
      });
  }
  private scrollPanelTop(): void {
    const panel = document.querySelector('.mat-autocomplete-panel') as HTMLElement;
    if (panel) panel.scrollTop = 0;
  }
  protected readonly JsonSchema = JsonSchema;
}
