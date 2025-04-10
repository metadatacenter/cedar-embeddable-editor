import { Component, Input, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIComponent } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ErrorStateMatcher } from '@angular/material/core';
import { Observable, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  tap,
  finalize,
  catchError,
} from 'rxjs/operators';
import { JsonSchema } from '../../../shared/models/json-schema.model';
import { RorFieldDataService } from '../../../shared/service/ror-field-data.service';
import { MessageHandlerService } from '../../../shared/service/message-handler.service';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { RorSearchResponseItem } from '../../../shared/models/rest/ror-search/ror-search-response-item';
import { RorDetailResponse } from '../../../shared/models/rest/ror-detail/ror-detail-response';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-cedar-input-ror',
  templateUrl: './cedar-input-ror.component.html',
  styleUrls: ['./cedar-input-ror.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarInputRorComponent extends CedarUIComponent implements OnInit {
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger })
  trigger: MatAutocompleteTrigger;
  selectedData: RorSearchResponseItem;
  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  @Input() handlerContext: HandlerContext;
  model: RorSearchResponseItem = null;
  rorDetails: RorDetailResponse = null;
  showDetails: boolean = false;
  readOnlyMode: boolean = false;
  filteredOptions: Observable<RorSearchResponseItem[]>;
  loadingOptions = false;
  private rorDetailsCache = new Map<string, RorDetailResponse>();
  private ignoreNextFilter: boolean = false;

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

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  ngOnInit(): void {
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
    this.readOnlyMode = this.handlerContext?.readOnlyMode || false;
    if (!this.readOnlyMode) {
      this.filteredOptions = this.inputValueControl.valueChanges.pipe(
        startWith(''),
        debounceTime(500),
        distinctUntilChanged(),
        tap(() => {
          this.loadingOptions = true;
        }),
        switchMap((val: string) => {
          if (this.ignoreNextFilter) {
            this.ignoreNextFilter = false;
            this.loadingOptions = false;
            return of([this.selectedData]);
          }
          if (this.selectedData && val.trim() === this.getCompoundValue(this.selectedData).trim()) {
            this.loadingOptions = false;
            return of([this.selectedData]);
          }
          return this.filter(val || '').pipe(
            finalize(() => {
              this.loadingOptions = false;
            }),
          );
        }),
      );
      if (this.trigger) {
        this.trigger.panelClosingActions.subscribe((event) => {
          if (!event) {
            if (!this.selectedData) {
              this.clearValue();
              this.inputValueControl.setErrors({ invalidRor: true });
            } else {
              this.setCurrentValue(this.getCompoundValue(this.selectedData));
              if (this.inputValueControl.errors && this.inputValueControl.errors.invalidRor) {
                const errors = { ...this.inputValueControl.errors };
                delete errors.invalidRor;
                this.inputValueControl.setErrors(Object.keys(errors).length > 0 ? errors : null);
              }
            }
          }
        });
      }
    }
  }

  private getCompoundValue(option: RorSearchResponseItem): string {
    if (!option) return '';
    const label = option.rdfsLabel ? option.rdfsLabel.trim() : '';
    const id = option.id ? option.id.trim() : '';
    return `${label} - ${id}`;
  }

  private filter(val: string): Observable<RorSearchResponseItem[]> {
    if (!val) {
      return of([]);
    }
    if (/^(http|0|ror\.org)/i.test(val)) {
      return this.rorFieldDataService.getDetails(val).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          } else {
            const details = RorDetailResponse.fromJSON(response);
            return [{ id: response.id, rdfsLabel: response.name, details: details }];
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
              (option: RorSearchResponseItem) => option.rdfsLabel?.toLowerCase().includes(val.toLowerCase()),
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

  onSelectionChange(option: RorSearchResponseItem): void {
    if (!option) {
      return;
    }
    this.selectedData = option;
    if (option.details) {
      this.rorDetails = option.details;
    } else {
      this.getDetails();
    }
    const { id, rdfsLabel } = option;
    this.handlerContext.changeControlledValue(this.component, id, rdfsLabel);
    this.ignoreNextFilter = true;
    this.setCurrentValue(this.getCompoundValue(option));
  }

  inputChanged(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    if (!target?.value?.trim()) {
      this.clearValue();
    }
  }

  setCurrentValue(currentValue: string): void {
    this.inputValueControl.setValue(currentValue, { emitEvent: false });
  }

  private updateValue(atId: string, prefLabel: string): void {
    if (!prefLabel) {
      return;
    }
    this.inputValueControl.setValue(prefLabel, { emitEvent: false });
    this.handlerContext.changeControlledValue(this.component, atId, prefLabel);
  }

  clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue(null, { emitEvent: false });
    this.handlerContext.changeControlledValue(this.component, null, null);
  }

  private getDetails(): void {
    if (!this.selectedData || !this.selectedData.id) {
      console.warn('No valid selected data to retrieve details.');
      return;
    }
    const selectedId = this.selectedData.id;
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

  private setValueUIAndModel(atId: string, prefLabel: string): void {
    this.inputValueControl.setValue(prefLabel, { emitEvent: false });
    this.handlerContext.changeControlledValue(this.component, atId, prefLabel);
  }

  setShowDetails = (setValue: boolean): void => {
    this.showDetails = setValue;
  };

  onClose(): void {
    if (!this.readOnlyMode) {
      const compoundValue = this.selectedData ? this.getCompoundValue(this.selectedData) : '';
      if (!this.selectedData || this.inputValueControl.value !== compoundValue) {
        this.setCurrentValue(compoundValue);
      }
    }
  }
}
