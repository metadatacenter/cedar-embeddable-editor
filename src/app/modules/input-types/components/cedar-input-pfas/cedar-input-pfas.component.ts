import { Component, Input, OnInit, ViewChild, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, switchMap, tap, finalize, catchError } from 'rxjs/operators';

import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { JsonSchema } from '../../../shared/models/json-schema.model';
import { PfasFieldDataService } from '../../../shared/service/pfas-field-data.service';
import { MessageHandlerService } from '../../../shared/service/message-handler.service';
import { PfasSearchResponseItem } from '../../../shared/models/rest/pfas-search/pfas-search-response-item';
import { PfasDetailResponse } from '../../../shared/models/rest/pfas-detail/pfas-detail-response';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';

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
export class CedarInputPfasComponent extends CedarUIDirective implements OnInit {
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger })
  trigger: MatAutocompleteTrigger;

  @Input() handlerContext: HandlerContext;

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  // --- state & form controls ---
  private pfasDetailsCache = new Map<string, PfasDetailResponse>();

  selectedData: PfasSearchResponseItem;
  component: FieldComponent;
  options: FormGroup;
  inputValueControl: FormControl;
  errorStateMatcher = new TextFieldErrorStateMatcher();
  filteredOptions: Observable<PfasSearchResponseItem[]>;
  loadingOptions = false;
  hasSearched = false;
  selectionInProgress = false;

  /** Name of the Material icon to use for the “view details” link */
  public linkIconName = 'open_in_new';

  constructor(
    private fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private pfasFieldDataService: PfasFieldDataService,
    private messageHandlerService: MessageHandlerService,
  ) {
    super();
  }

  ngOnInit(): void {
    super.ngOnInit();

    // 1) Build the form control with “required” if needed
    const validators: any[] = [];
    if (this.component?.valueInfo?.requiredValue) {
      validators.push(Validators.required);
    }
    this.inputValueControl = new FormControl(null, validators);
    this.options = this.fb.group({ inputValue: this.inputValueControl });

    // 2) Apply any defaultValue
    if (this.component?.valueInfo?.defaultValue) {
      const defaultAtId = this.component.valueInfo.defaultValue[JsonSchema.atId] || null;
      const defaultLabel = this.component.valueInfo.defaultValue[JsonSchema.rdfsLabel] || null;
      this.updateValue(defaultAtId, defaultLabel);
    }

    // 3) Wire up autocomplete (only in edit mode)
    if (!this.readOnlyMode) {
      this.filteredOptions = this.inputValueControl.valueChanges.pipe(
        debounceTime(500),
        distinctUntilChanged(),
        filter((val) => val?.trim().length > 0),
        tap(() => {
          this.loadingOptions = true;
          this.hasSearched = false;
        }),
        switchMap((val) =>
          this.filter(val).pipe(
            finalize(() => {
              this.loadingOptions = false;
              this.hasSearched = true;
              this.cdr.markForCheck();
            }),
          ),
        ),
      );
    }
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

  onSelectionChange(option: PfasSearchResponseItem): void {
    if (!option) return;
    this.selectionInProgress = false;
    this.selectedData = option;
    const id = option[JsonSchema.atId];
    const label = option[JsonSchema.rdfsLabel];
    this.handlerContext.changeControlledValue(this.component, id, label);
    this.setCurrentValue(option);
  }

  onInputBlur(): void {
    if (this.selectionInProgress) return;
    this.loadingOptions = false;
    this.cdr.markForCheck();

    const raw = this.inputValueControl.getRawValue()?.trim();
    const current = this.getCompoundValue(this.selectedData);

    if (raw && raw !== current) {
      if (this.selectedData) {
        this.inputValueControl.setValue(current, { emitEvent: false });
        this.showRevertHint();
        this.hasSearched = false;
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
  setCurrentValue(value: PfasSearchResponseItem): void {
    if (!value) return;
    const display = this.getCompoundValue(value);
    if (this.inputValueControl.value !== display) {
      this.inputValueControl.setValue(display, { emitEvent: false });
      this.selectedData = value;
    }
    this.getDetails(); // caches, but only calls service once per PFAS
    this.hasSearched = false;
  }

  clearValue(markError: boolean = false): void {
    this.selectedData = null;
    this.inputValueControl.setValue('', { emitEvent: true });
    if (markError) {
      this.inputValueControl.setErrors({ invalidPfas: true });
      this.inputValueControl.markAsTouched();
    } else {
      this.inputValueControl.setErrors(null);
    }
    this.handlerContext.changeControlledValue(this.component, null, null);
  }

  /** Expose the PFAS registry URL for our link */
  get detailsUrl(): string | null {
    return this.selectedData?.[JsonSchema.atId] || null;
  }

  private getCompoundValue(opt: PfasSearchResponseItem): string {
    const label = opt?.[JsonSchema.rdfsLabel]?.trim() || '';
    const id = opt?.[JsonSchema.atId]?.trim() || '';
    return label || id ? `${label} - ${id}` : '';
  }

  private filter(val: string): Observable<PfasSearchResponseItem[]> {
    // if the user typed exactly the currently selected option, just return it
    if (this.getCompoundValue(this.selectedData) === val) {
      return of([this.selectedData]);
    }

    // if it looks like a URI or DTXSID, fetch details
    if (/^(http|DTXSID|comptox\.epa\.gov)/i.test(val)) {
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

    // otherwise do a search
    return this.pfasFieldDataService.getData(val).pipe(
      map((resp) => {
        if (!resp || resp.found === false) return [];
        if (resp.results) {
          return resp.results.filter(
            (o: PfasSearchResponseItem) => o[JsonSchema.rdfsLabel]?.toLowerCase().includes(val.toLowerCase()),
          );
        }
        this.messageHandlerService.errorObject(val, resp);
        return [];
      }),
      catchError((err) => {
        console.error('Error in getData:', err);
        return of([]);
      }),
    );
  }

  private updateValue(atId: string, prefLabel: string): void {
    if (!prefLabel) return;
    this.inputValueControl.setValue(prefLabel, { emitEvent: false });
    this.handlerContext.changeControlledValue(this.component, atId, prefLabel);
  }

  /** Cache details so we only ever call getDetails() once per PFAS */
  private getDetails(): void {
    const id = this.selectedData?.[JsonSchema.atId];
    if (!id || this.pfasDetailsCache.has(id)) return;

    this.pfasFieldDataService
      .getDetails(id)
      .pipe(
        catchError((err) => {
          console.error('Error retrieving PFAS details:', err);
          return of(null);
        }),
      )
      .subscribe((resp) => {
        if (resp?.found) {
          this.pfasDetailsCache.set(id, PfasDetailResponse.fromJSON(resp));
        }
      });
  }

  private showRevertHint(): void {
    this.cdr.markForCheck();
    setTimeout(() => {
      this.cdr.markForCheck();
    }, 5000);
  }

  protected readonly JsonSchema = JsonSchema;
}
