import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';

@Component({
  selector: 'app-cedar-input-multiple-choice',
  templateUrl: './cedar-input-multiple-choice.component.html',
  styleUrls: ['./cedar-input-multiple-choice.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarInputMultipleChoiceComponent extends CedarUIComponent implements OnInit {
  component: FieldComponent;
  activeComponentRegistry: ActiveComponentRegistryService;
  options: FormGroup;
  selectedChoiceInputControl = new FormControl(null, null);
  @Input() handlerContext: HandlerContext;

  constructor(fb: FormBuilder, public cds: ComponentDataService, activeComponentRegistry: ActiveComponentRegistryService) {
    super();
    this.options = fb.group({
      selectedChoiceValue: this.selectedChoiceInputControl
    });
    this.activeComponentRegistry = activeComponentRegistry;
  }

  ngOnInit(): void {
    this.populateItemsOnLoad();
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  inputChanged(event): void {
    this.handlerContext.changeValue(this.component, event.value);
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
