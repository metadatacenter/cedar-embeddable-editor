import { Component, Input, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ErrorStateMatcher } from '@angular/material/core';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, tap, finalize, catchError } from 'rxjs/operators';
import { JsonSchema } from '../../../shared/models/json-schema.model';
import { RorFieldDataService } from '../../../shared/service/ror-field-data.service';
import { MessageHandlerService } from '../../../shared/service/message-handler.service';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { RorSearchResponseItem } from '../../../shared/models/rest/ror-search/ror-search-response-item';
import { RorDetailResponse } from '../../../shared/models/rest/ror-detail/ror-detail-response';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
@Component({
  selector: 'app-cedar-input-ror',
  templateUrl: './cedar-input-ror.component.html',
  styleUrls: ['./cedar-input-ror.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarInputRorComponent extends CedarUIDirective implements OnInit {
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger })
  trigger: MatAutocompleteTrigger;

  @Input() handlerContext: HandlerContext;
  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  selectedData: RorSearchResponseItem;
  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  model: RorSearchResponseItem = null;
  rorDetails: RorDetailResponse = null;
  showDetails: boolean = false;
  filteredOptions: Observable<RorSearchResponseItem[]>;
  loadingOptions = false;
  private rorDetailsCache = new Map<string, RorDetailResponse>();
  justReverted: boolean;
  hasSearched: boolean;
  selectionInProgress = false;

  constructor(
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private rorFieldDataService: RorFieldDataService,
    private messageHandlerService: MessageHandlerService,
  ) {
    super();
    this.options = fb.group({ inputValue: this.inputValueControl });
  }

  ngOnInit(): void {
    super.ngOnInit();
    const validators: any[] = [];
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
            this.hasSearched = true;
            return of([this.selectedData]);
          }

          this.loadingOptions = true;
          this.hasSearched = false;

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
  onSelectionChange(option: RorSearchResponseItem): void {
    if (!option) return;
    this.selectionInProgress = false;
    this.selectedData = option;

    const id = option[JsonSchema.atId];
    const rdfsLabel = option[JsonSchema.rdfsLabel];
    this.handlerContext.changeControlledValue(this.component, id, rdfsLabel);

    this.setCurrentValue(option);
  }
  onInputBlur() {
    if (this.selectionInProgress) return;
    this.loadingOptions = false;
    this.cdr.markForCheck();

    const raw = this.inputValueControl.getRawValue()?.trim();
    const current = this.getCompoundValue(this.selectedData);
    if (this.loadingOptions) return;
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
  setCurrentValue(value: RorSearchResponseItem): void {
    if (value) {
      const display = this.getCompoundValue(value);
      if (this.inputValueControl.value !== display) {
        this.inputValueControl.setValue(display, { emitEvent: false });
        this.selectedData = value;
      }
      this.getDetails();
      this.hasSearched = false;
    }
  }
  clearValue(markError: boolean = false): void {
    this.selectedData = null;
    this.inputValueControl.setValue('', { emitEvent: true });
    if (markError) {
      this.inputValueControl.setErrors({ invalidRor: true });
      this.inputValueControl.markAsTouched();
    } else {
      this.inputValueControl.setErrors(null);
    }
    this.handlerContext.changeControlledValue(this.component, null, null);
  }
  setShowDetails = (setValue: boolean): void => {
    this.showDetails = setValue;
  };
  getCompoundValue(option: RorSearchResponseItem): string {
    if (!option) return '';
    const label = option[JsonSchema.rdfsLabel] ? option[JsonSchema.rdfsLabel].trim() : '';
    const id = option[JsonSchema.atId] ? option[JsonSchema.atId].trim() : '';
    return `${label} - ${id}`;
  }
  private filter(val: string): Observable<RorSearchResponseItem[]> {
    if (this.getCompoundValue(this.selectedData) === val || val === undefined || val === '') {
      return of([]);
    }
    if (/^(http|0|ror\.org)/i.test(val)) {
      return this.rorFieldDataService.getDetails(val).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          } else {
            const details = RorDetailResponse.fromJSON(response);
            if (!this.rorDetailsCache.has(response[JsonSchema.atId])) {
              this.rorDetailsCache.set(response[JsonSchema.atId], details);
            }
            return [{ [JsonSchema.atId]: response.id, [JsonSchema.rdfsLabel]: response.name, details: details }];
          }
        }),
        catchError((error) => {
          console.error('Error in getDetails:', error);
          return of([]);
        }),
      );
    } else {
      return this.rorFieldDataService.getData(val).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          } else if (response.results) {
            return response.results.filter(
              (option: RorSearchResponseItem) =>
                option[JsonSchema.rdfsLabel]?.toLowerCase().includes(val.toLowerCase()),
            );
          } else {
            this.messageHandlerService.errorObject(val, response);
            return [];
          }
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
  private getDetails(): void {
    if (!this.selectedData || !this.selectedData[JsonSchema.atId]) {
      console.warn('No valid selected data to retrieve details.');
      return;
    }
    const selectedId = this.selectedData[JsonSchema.atId];
    if (this.rorDetailsCache.has(selectedId)) {
      this.rorDetails = this.rorDetailsCache.get(selectedId);
      return;
    }
    this.rorFieldDataService
      .getDetails(selectedId)
      .pipe(
        catchError((error) => {
          console.error('Error retrieving details:', error);
          return of(null);
        }),
      )
      .subscribe((response: RorDetailResponse) => {
        if (response && response.found) {
          this.rorDetails = RorDetailResponse.fromJSON(response);
          this.rorDetailsCache.set(selectedId, this.rorDetails);
        }
      });
  }
  private showRevertHint(): void {
    this.justReverted = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.justReverted = false;
      this.cdr.markForCheck();
    }, 5000);
  }
  protected readonly JsonSchema = JsonSchema;
}
