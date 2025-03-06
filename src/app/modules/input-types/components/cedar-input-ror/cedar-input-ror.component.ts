import { Component, Input, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIComponent } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ErrorStateMatcher } from '@angular/material/core';
import { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
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
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger }) trigger: MatAutocompleteTrigger;
  selectedData: RorSearchResponseItem;
  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  @Input() handlerContext: HandlerContext;
  model: RorSearchResponseItem = null;
  rorDetails: RorDetailResponse = null;
  showDetails: boolean = false;
  readOnlyMode;

  filteredOptions: Observable<RorSearchResponseItem[]>;
  private rorDetailsCache = new Map<string, RorDetailResponse>();

  constructor(
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private rorFieldDataService: RorFieldDataService,
    private messageHandlerService: MessageHandlerService,
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
    const validators: any[] = [];

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    this.inputValueControl = new FormControl(null, validators);

    if (this.component.valueInfo.defaultValue) {
      this.setValueUIAndModel(
        this.component.valueInfo.defaultValue ? this.component.valueInfo.defaultValue[JsonSchema.atId] : null,
        this.component.valueInfo.defaultValue ? this.component.valueInfo.defaultValue[JsonSchema.rdfsLabel] : null,
      );
    }

    if (this.handlerContext && this.handlerContext.readOnlyMode) {
      this.readOnlyMode = this.handlerContext.readOnlyMode;
    }

    if (!this.readOnlyMode) {
      this.filteredOptions = this.inputValueControl.valueChanges.pipe(
        startWith(''),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((val) => {
          return this.filter(val || '');
        }),
      );
    }
  }
  filter(val: string): Observable<RorSearchResponseItem[]> {
    if (/^(http|0|ror.org)/.test(val)) {
      return this.rorFieldDataService.getDetails(val).pipe(
        map((response) => {
          if (response.found === false) {
            return [];
          } else {
            const details = RorDetailResponse.fromJSON(response);
            return [
              {
                id: response.requestedId,
                rdfsLabel: response.name,
                details: details, // Attach the details here.
              },
            ];
          }
        }),
      );
    } else {
      return this.rorFieldDataService.getData(val).pipe(
        map((response) => {
          if (response.found === false) {
            return [];
          } else if (response.results) {
            return response.results.filter((option) => {
              return option.rdfsLabel.toLowerCase().indexOf(val.toLowerCase()) >= 0;
            });
          } else {
            if (!val) {
              val = 'empty string';
            }
            this.messageHandlerService.errorObject(val, response);
          }
        }),
      );
    }
  }

  onClose() {
    if (!this.readOnlyMode) {
      if (!this.selectedData || this.inputValueControl.value !== this.selectedData?.rdfsLabel) {
        this.setCurrentValue(this.selectedData?.rdfsLabel);
      }
    }
  }
  onSelectionChange(option: RorSearchResponseItem): void {
    if (!option) return;
    this.selectedData = option;
    if (option.details) {
      this.rorDetails = option.details;
    } else {
      this.getDetails();
    }
    const { id, rdfsLabel } = this.selectedData;
    this.handlerContext.changeControlledValue(this.component, id, rdfsLabel);
    this.setValueUIAndModel(id, rdfsLabel);
  }
  inputChanged(event): void {
    if (!(event.target as HTMLTextAreaElement).value) {
      this.clearValue();
    }
  }
  setCurrentValue(currentValue: any): void {
    this.inputValueControl.setValue(currentValue);
  }
  clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue(null);
    this.handlerContext.changeControlledValue(this.component, null, null);
  }
  getDetails() {
    const selectedId = this.selectedData.id;
    if (this.rorDetailsCache.has(selectedId)) {
      this.rorDetails = this.rorDetailsCache.get(selectedId);
      return;
    }
    this.rorFieldDataService.getDetails(selectedId).subscribe((response: RorDetailResponse) => {
      if (response.found) {
        this.rorDetails = RorDetailResponse.fromJSON(response);
        this.rorDetailsCache.set(selectedId, this.rorDetails);
      }
    });
  }
  private setValueUIAndModel(atId: string, prefLabel: string): void {
    this.inputValueControl.setValue(prefLabel);
    this.handlerContext.changeControlledValue(this.component, atId, prefLabel);
  }
  setShowDetails = (setValue: boolean): void => {
    this.showDetails = setValue;
  };
}
