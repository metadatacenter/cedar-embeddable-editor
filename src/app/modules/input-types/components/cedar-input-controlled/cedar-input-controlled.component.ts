import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';
import {ErrorStateMatcher} from '@angular/material/core';
import {Observable} from 'rxjs';
import {debounceTime, distinctUntilChanged, map, startWith, switchMap} from 'rxjs/operators';
import {IntegratedSearchResponseItem} from '../../../shared/models/rest/integrated-search/integrated-search-response-item';
import {JsonSchema} from '../../../shared/models/json-schema.model';
import {ControlledFieldDataService} from '../../../shared/service/controlled-field-data.service';
import {MessageHandlerService} from '../../../shared/service/message-handler.service';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-cedar-input-controlled',
  templateUrl: './cedar-input-controlled.component.html',
  styleUrls: ['./cedar-input-controlled.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarInputControlledComponent extends CedarUIComponent implements OnInit {

  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  @Input() handlerContext: HandlerContext;
  model: IntegratedSearchResponseItem = null;

  filteredOptions: Observable<IntegratedSearchResponseItem[]>;

  constructor(
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private controlledFieldDataService: ControlledFieldDataService,
    private messageHandlerService: MessageHandlerService
  ) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
  }

  ngOnInit(): void {
    const validators: any[] = [];

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    this.inputValueControl = new FormControl(null, validators);

    if (this.component.valueInfo.defaultValue &&
      typeof this.component.valueInfo.defaultValue === 'object' &&
      (this.component.valueInfo.defaultValue as object).hasOwnProperty(JsonSchema.termUri)) {
      this.setValueUIAndModel(this.component.valueInfo.defaultValue ? this.component.valueInfo.defaultValue[JsonSchema.termUri] : null,
        this.component.valueInfo.defaultValue ? this.component.valueInfo.defaultValue[JsonSchema.rdfsLabel] : null);
    }

    this.filteredOptions = this.inputValueControl.valueChanges
      .pipe(
        startWith(''),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(val => {
          return this.filter(val || '');
        })
      );
  }

  filter(val: string): Observable<IntegratedSearchResponseItem[]> {
    return this.controlledFieldDataService.getData(val, this.component).pipe(
      map(response => {
        if (response == null) {
          return null;
        } else if (response.collection) {
          return response.collection.filter(option => {
            return option.prefLabel.toLowerCase().indexOf(val.toLowerCase()) === 0;
          });
        } else {
          if (!val) {
            val = 'empty string';
          }
          this.messageHandlerService.errorObject(val, response);
        }
      })
    );
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  onSelectionChange(option: IntegratedSearchResponseItem): void {
    this.handlerContext.changeControlledValue(this.component, option[JsonSchema.atId], option.prefLabel);
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
    this.inputValueControl.setValue(null);
    this.handlerContext.changeControlledValue(this.component, null, null);
  }

  private setValueUIAndModel(atId: string, prefLabel: string): void {
    this.inputValueControl.setValue(prefLabel);
    this.handlerContext.changeControlledValue(this.component, atId, prefLabel);
  }

}
