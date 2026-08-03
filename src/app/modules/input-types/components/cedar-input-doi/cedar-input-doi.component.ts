import { Component, Input, OnInit, ViewChild, ViewEncapsulation, OnDestroy, AfterViewInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  switchMap,
  catchError,
  startWith,
  finalize,
} from 'rxjs/operators';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { AuthoritySearchControl } from '../../../shared/util/authority-search-control';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { JsonSchema } from '../../../shared/models/json-schema.model';
import { DoiFieldDataService } from '../../../shared/service/doi-field-data.service';
import { DoiSearchResponseItem } from '../../../shared/models/rest/doi-search/doi-search-response-item';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { DoiDetailResponse } from '../../../shared/models/rest/doi-detail/doi-detail-response';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-cedar-input-doi',
  templateUrl: './cedar-input-doi.component.html',
  styleUrls: ['./cedar-input-doi.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarInputDoiComponent extends CedarUIDirective implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger }) trigger: MatAutocompleteTrigger;
  @Input() handlerContext: HandlerContext;
  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }
  justReverted: boolean;
  selectedData: DoiSearchResponseItem;
  component: FieldComponent;
  options: FormGroup;
  inputValueControl!: FormControl;
  errorStateMatcher = new TextFieldErrorStateMatcher();
  filteredOptions: Observable<DoiSearchResponseItem[]>;
  loadingOptions = false;

  public linkIconName = 'open_in_new';

  constructor(
    private fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private doiFieldDataService: DoiFieldDataService,
  ) {
    super();
  }

  ngOnInit(): void {
    super.ngOnInit();
    const validators: any[] = [];
    if (this.component?.valueInfo?.requiredValue) {
      validators.push(Validators.required);
    }
    // Deliberately no `CedarValidators.forComponent` here. This control holds what
    // the user is typing, and after a selection it holds "Label - https://iri";
    // the IRI itself only ever reaches the model. Validating the control as
    // though it were the field's value rejects every intermediate state, which
    // put "not a valid ... and has been cleared" under the field on the first
    // keystroke, over a field that had not been cleared. The stored IRI is
    // checked by the data quality report, which sees the value rather than the
    // search text; the discarded-edit error is raised explicitly on blur.
    this.inputValueControl = new FormControl(null, validators);
    this.options = this.fb.group({
      inputValue: this.inputValueControl,
    });

    if (
      this.component.valueInfo.defaultValue &&
      typeof this.component.valueInfo.defaultValue === 'object' &&
      Object.hasOwn(this.component.valueInfo.defaultValue as object, JsonSchema.atId) &&
      Object.hasOwn(this.component.valueInfo.defaultValue as object, JsonSchema.rdfsLabel)
    ) {
      // @ts-ignore
      const defaultAtId = this.component.valueInfo.defaultValue[JsonSchema.atId] || null;
      // @ts-ignore
      const defaultLabel = this.component.valueInfo.defaultValue[JsonSchema.rdfsLabel] || null;
      this.setValueUIAndModel(defaultAtId, defaultLabel);
    }
    if (!this.readOnlyMode) {
      this.filteredOptions = this.inputValueControl.valueChanges.pipe(
        startWith(''),
        debounceTime(400),
        map((v: any) => (typeof v === 'string' ? v : v?.[JsonSchema.rdfsLabel] ?? '')),
        map((v: string) => v.trim()),
        distinctUntilChanged(),
        switchMap((q: string) => {
          if (!q) {
            this.loadingOptions = false;
            return of<DoiSearchResponseItem[]>([]);
          }
          this.loadingOptions = true;
          return this.filter(q).pipe(
            catchError(() => of<DoiSearchResponseItem[]>([])),
            finalize(() => {
              this.loadingOptions = false;
            }),
          );
        }),
      );
    }
  }
  ngAfterViewInit(): void {
    if (!this.readOnlyMode) {
      this.trigger.panelClosingActions.subscribe((event) => {
        const selectionMode = !!event && !!(event as any).source;
        if (selectionMode) return;
        this.setCurrentValue(this.selectedData);
      });
    }
  }
  onSelectionChange(option: DoiSearchResponseItem): void {
    if (!option) return;
    this.selectedData = option;
    const id = option[JsonSchema.atId];
    const label = option[JsonSchema.rdfsLabel];
    this.handlerContext.changeControlledValue(this.component, id, label);
  }
  inputChanged(event): void {
    if (!(event.target as HTMLTextAreaElement).value) {
      this.clearValue();
    }
  }
  inputFocused(): void {
    if (this.readOnlyMode) return;
    const currentValue = this.inputValueControl.value ?? '';
    this.inputValueControl.setValue(currentValue, { emitEvent: true });
  }
  setCurrentValue(value: DoiSearchResponseItem): void {
    this.selectedData = value;
    const display = this.getCompoundValue(value);
    this.inputValueControl.setValue(display, { emitEvent: true });
  }

  clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue(null);
    this.inputValueControl.setErrors(null);
    this.handlerContext.changeControlledValue(this.component, null, null);
  }

  /**
   * Reconcile the box with the value behind it when the user leaves.
   *
   * This widget had no blur handler at all, so free text stayed in the field
   * over an instance that held nothing — it looked filled and read back blank.
   * The `mat-error` in the template was decoration over a code path that did
   * not exist. See `AuthoritySearchControl`.
   */
  onInputBlur(): void {
    if (this.readOnlyMode) {
      return;
    }
    const outcome = AuthoritySearchControl.reconcileOnBlur(
      this.inputValueControl,
      this.getCompoundValue(this.selectedData),
      'invalidDoi',
    );
    if (outcome === 'cleared') {
      this.selectedData = null;
      this.handlerContext.changeControlledValue(this.component, null, null);
    }
  }
  private setValueUIAndModel(atId: string, prefLabel: string): void {
    this.inputValueControl.setValue(prefLabel);
    this.handlerContext.changeControlledValue(this.component, atId, prefLabel);
  }
  get detailsUrl(): string | null {
    return this.selectedData?.[JsonSchema.atId] || null;
  }
  getCompoundValue(opt: DoiSearchResponseItem): string {
    const label = opt?.[JsonSchema.rdfsLabel]?.trim() || '';
    const id = opt?.[JsonSchema.atId]?.trim() || '';
    return label || id ? `${label} - ${id}` : '';
  }
  filter(val: string): Observable<DoiSearchResponseItem[]> {
    if (this.selectedData && this.getCompoundValue(this.selectedData) === val) {
      return of([this.selectedData]);
    }
    if (this.isIdOrIri(val)) {
      return this.doiFieldDataService.getDetails(val).pipe(
        map((resp) => {
          if (!resp || resp.found === false) return [];
          const details = DoiDetailResponse.fromJSON(resp);
          return [{ [JsonSchema.atId]: resp.id, [JsonSchema.rdfsLabel]: resp.name, details }];
        }),
        catchError((err) => {
          console.error('Error in getDetails:', err);
          return of([]);
        }),
      );
    }
    return this.doiFieldDataService.getData(val).pipe(
      map((resp: any) => {
        const results: DoiSearchResponseItem[] = Array.isArray(resp)
          ? resp
          : Array.isArray(resp?.results)
            ? resp.results
            : [];

        if (!results.length) return [];
        const v = (val || '').toLowerCase();
        return v ? results.filter((o) => (o?.[JsonSchema.rdfsLabel] ?? '').toLowerCase().includes(v)) : results;
      }),
      catchError((err) => {
        console.error('Error in getData:', err);
        return of([]);
      }),
    );
  }
  private isIdOrIri(q: string): boolean {
    const s = (q ?? '').trim();
    return /^(https?:\/\/|http:\/\/|doi:|10\.)/i.test(s);
  }
  get isEmpty(): boolean {
    const raw = this.inputValueControl.value;
    const q = (typeof raw === 'string' ? raw : raw?.[JsonSchema.rdfsLabel] ?? '').trim();
    return !q;
  }
  protected readonly JsonSchema = JsonSchema;
}
