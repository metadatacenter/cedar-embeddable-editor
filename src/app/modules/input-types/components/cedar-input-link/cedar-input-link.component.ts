import { Component, Input, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarValidators } from '../../../shared/validation/cedar-validators';

@Component({
  selector: 'app-cedar-input-link',
  templateUrl: './cedar-input-link.component.html',
  styleUrls: ['./cedar-input-link.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputLinkComponent extends CedarUIDirective implements OnInit {
  component!: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl<string | null>(null, null);
  @Input({ required: true }) handlerContext!: HandlerContext;

  constructor(
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    const validators: ValidatorFn[] = [];

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }

    validators.push(CedarValidators.forComponent(this.component));
    this.inputValueControl = new FormControl<string | null>(null, validators);

    // `typeof`, not a cast: on a literal field the declared default is text, and a
    // template that puts a term node here is declaring something this field cannot
    // hold — which is now skipped rather than assigned as `[object Object]`.
    const declaredDefault = this.component.valueInfo.defaultValue;
    if (typeof declaredDefault === 'string' && this.inputValueControl.getRawValue() == '') {
      this.setValueUIAndModel(declaredDefault);
    }
  }

  @Input({ required: true }) set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  inputChanged($event: Event): void {
    const typed = ($event.target as HTMLTextAreaElement).value;
    this.handlerContext.changeValue(this.component, typed.length === 0 ? null : typed);
  }

  setCurrentValue(currentValue: unknown): void {
    this.inputValueControl.setValue(typeof currentValue === 'string' ? currentValue : null);
  }

  clearValue(): void {
    this.setValueUIAndModel(null);
  }

  private setValueUIAndModel(value: string | null): void {
    this.inputValueControl.setValue(value);
    this.handlerContext.changeValue(this.component, value);
  }

  getCharCountHint(): string {
    let len = 0;
    if (this.inputValueControl.value != null) {
      len = this.inputValueControl.value.length;
    }
    return '' + len;
  }
}
