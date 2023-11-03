import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { CedarUIComponent } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ErrorStateMatcher } from '@angular/material/core';

export class MultipleChoiceErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-cedar-input-multiple-choice',
  templateUrl: './cedar-input-multiple-choice.component.html',
  styleUrls: ['./cedar-input-multiple-choice.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarInputMultipleChoiceComponent extends CedarUIComponent implements OnInit {
  component: FieldComponent;
  options: FormGroup;
  selectedChoiceInputControl = new FormControl(null, null);
  errorStateMatcher = new MultipleChoiceErrorStateMatcher();
  @Input() handlerContext: HandlerContext;

  constructor(
    fb: FormBuilder,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
    this.options = fb.group({
      selectedChoiceValue: this.selectedChoiceInputControl,
    });
  }

  ngOnInit(): void {
    this.populateItemsOnLoad();
    const validators: any[] = [];
    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    this.selectedChoiceInputControl = new FormControl(null, validators);
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  inputChanged(event): void {
    this.handlerContext.changeValue(this.component, event.value);
  }

  clearValue(): void {
    this.setValueUIAndModel(null);
  }

  private setValueUIAndModel(value: string): void {
    this.selectedChoiceInputControl.setValue(value);
    this.handlerContext.changeValue(this.component, value);
  }

  setCurrentValue(currentValue: any): void {
    this.selectedChoiceInputControl.setValue(currentValue);
  }

  private populateItemsOnLoad(): void {
    for (const choice of this.component.choiceInfo.choices) {
      if (choice.selectedByDefault) {
        this.handlerContext.changeValue(this.component, choice.label);
        return;
      }
    }
    this.handlerContext.changeValue(this.component, null);
  }
}
