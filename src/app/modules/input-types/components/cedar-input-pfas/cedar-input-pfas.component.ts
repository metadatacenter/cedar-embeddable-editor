import { Component, Input, OnInit, ViewChild, ViewEncapsulation, OnDestroy, AfterViewInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, catchError, startWith, finalize } from 'rxjs/operators';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { JsonSchema } from '../../../shared/models/json-schema.model';
import { PfasFieldDataService } from '../../../shared/service/pfas-field-data.service';
import { PfasSearchResponseItem } from '../../../shared/models/rest/pfas-search/pfas-search-response-item';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { PfasDetailResponse } from '../../../shared/models/rest/pfas-detail/pfas-detail-response';
import { CedarValidators } from '../../../shared/validation/cedar-validators';
export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
@Component({
  selector: 'app-cedar-input-pfas',
  templateUrl: './cedar-input-pfas.component.html',
  styleUrls: ['./cedar-input-pfas.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarInputPfasComponent extends CedarUIDirective implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger }) trigger: MatAutocompleteTrigger;
  @Input() handlerContext: HandlerContext;
  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }
  justReverted: boolean;
  selectedData: PfasSearchResponseItem;
  component: FieldComponent;
  options: FormGroup;
  inputValueControl!: FormControl;
  errorStateMatcher = new TextFieldErrorStateMatcher();
  filteredOptions: Observable<PfasSearchResponseItem[]>;
  loadingOptions = false;

  public linkIconName = 'open_in_new';

  constructor(
    private fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private pfasFieldDataService: PfasFieldDataService,
  ) {
    super();
  }

  ngOnInit(): void {
    super.ngOnInit();
    const validators: any[] = [];
    if (this.component?.valueInfo?.requiredValue) {
      validators.push(Validators.required);
    }
    validators.push(CedarValidators.forComponent(this.component));
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
            return of<PfasSearchResponseItem[]>([]);
          }
          this.loadingOptions = true;
          return this.filter(q).pipe(
            catchError(() => of<PfasSearchResponseItem[]>([])),
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
  onSelectionChange(option: PfasSearchResponseItem): void {
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
    if (!this.readOnlyMode) {
      const currentValue = this.inputValueControl.value ?? '';
      this.inputValueControl.setValue(currentValue, { emitEvent: true });
    }
  }
  setCurrentValue(value: PfasSearchResponseItem): void {
    this.selectedData = value;
    const display = this.getCompoundValue(value);
    this.inputValueControl.setValue(display, { emitEvent: true });
  }

  clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue(null);
    this.handlerContext.changeControlledValue(this.component, null, null);
  }
  private setValueUIAndModel(atId: string, prefLabel: string): void {
    this.inputValueControl.setValue(prefLabel);
    this.handlerContext.changeControlledValue(this.component, atId, prefLabel);
  }
  get detailsUrl(): string | null {
    return this.selectedData?.[JsonSchema.atId] || null;
  }
  getCompoundValue(opt: PfasSearchResponseItem): string {
    const label = opt?.[JsonSchema.rdfsLabel]?.trim() || '';
    const id = opt?.[JsonSchema.atId]?.trim() || '';
    return label || id ? `${label} - ${id}` : '';
  }
  filter(val: string): Observable<PfasSearchResponseItem[]> {
    if (this.selectedData && this.getCompoundValue(this.selectedData) === val) {
      return of([this.selectedData]);
    }
    if (this.isIdOrIri(val)) {
      return this.pfasFieldDataService.getDetails(val).pipe(
        map((resp) => {
          if (!resp || resp.found === false) return [];
          const details = PfasDetailResponse.fromJSON(resp);
          return [{ [JsonSchema.atId]: resp.id, [JsonSchema.rdfsLabel]: resp.name, details }];
        }),
        catchError((err) => {
          console.error('Error in getDetails:', err);
          return of([]);
        }),
      );
    }
    return this.pfasFieldDataService.getData(val).pipe(
      map((resp: any) => {
        const results: PfasSearchResponseItem[] = Array.isArray(resp)
          ? resp
          : Array.isArray(resp?.results)
            ? resp.results
            : [];

        if (!results.length) return [];
        const v = (val || '').toLowerCase();
        return v ? results.filter((o) => (o?.[JsonSchema.rdfsLabel] ?? '').toLowerCase().includes(v)) : results; // if empty query, show what backend returns
      }),
      catchError((err) => {
        console.error('Error in getData:', err);
        return of([]);
      }),
    );
  }
  private isIdOrIri(q: string): boolean {
    const s = (q ?? '').trim();
    return /^(https?:\/\/|http:\/\/|DTXSID|comptox\.epa\.gov)/i.test(s);
  }
  get isEmpty(): boolean {
    const raw = this.inputValueControl.value;
    const q = (typeof raw === 'string' ? raw : raw?.[JsonSchema.rdfsLabel] ?? '').trim();
    return !q;
  }
  protected readonly JsonSchema = JsonSchema;
}
