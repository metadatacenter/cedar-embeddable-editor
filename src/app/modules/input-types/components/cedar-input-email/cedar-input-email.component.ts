import { Component, Input, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarValidators } from '../../../shared/validation/cedar-validators';

@Component({
  selector: 'app-cedar-input-email',
  templateUrl: './cedar-input-email.component.html',
  styleUrls: ['./cedar-input-email.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputEmailComponent extends CedarUIDirective implements OnInit {
  component!: FieldComponent;
  /*
   * Both built in `ngOnInit`, because the control's validators come off the
   * component and that arrives as an input. Asserted rather than made optional:
   * Angular runs `ngOnInit` before it first checks the template that binds them,
   * so there is no render in which they are absent. The same shape
   * `AbstractAuthorityInputComponent` already uses.
   */
  options!: FormGroup;
  inputValueControl = new FormControl<string | null>(null, null);
  @Input({ required: true }) handlerContext!: HandlerContext;

  constructor(
    private readonly fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    const validators: ValidatorFn[] = [];

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    validators.push(CedarValidators.forComponent(this.component));
    this.inputValueControl = new FormControl<string | null>(null, validators);
    // Beside the control it holds. Built in the constructor, the group kept the
    // control this line replaces — see `input-control-binding.spec.ts`.
    this.options = this.fb.group({ inputValue: this.inputValueControl });
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
