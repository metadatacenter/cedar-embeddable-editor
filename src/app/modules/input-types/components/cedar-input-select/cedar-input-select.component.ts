import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormBuilder} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';


@Component({
  selector: 'app-cedar-input-select',
  templateUrl: './cedar-input-select.component.html',
  styleUrls: ['./cedar-input-select.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarInputSelectComponent extends CedarUIComponent implements OnInit {
  readonly ITEM_ID_FIELD = 'id';
  readonly ITEM_TEXT_FIELD = 'label';

  component: FieldComponent;
  activeComponentRegistry: ActiveComponentRegistryService;
  dropdownList = [];
  selectedItems: any;

  @Input() handlerContext: HandlerContext;


  constructor(fb: FormBuilder, public cds: ComponentDataService, activeComponentRegistry: ActiveComponentRegistryService) {
    super();
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
    const values = [];

    if (Array.isArray(this.selectedItems) && this.selectedItems.length > 0) {
      values.push(...this.selectedItems.map(a => a[this.ITEM_ID_FIELD]));
    } else if (this.selectedItems && this.selectedItems.hasOwnProperty(this.ITEM_ID_FIELD)) {
      values.push(this.selectedItems[this.ITEM_ID_FIELD]);
    } else {
      values.push(null);
    }

    if (this.component.isMultiPage()) {
      this.handlerContext.changeValue(this.component, values[0]);
    } else {
      this.handlerContext.changeListValue(this.component, values);
    }
  }

  setCurrentValue(currentValue: any): void {
  }

  private populateItemsOnLoad(): void {
    for (const choice of this.component.choiceInfo.choices) {
      const entry = {};
      entry[this.ITEM_ID_FIELD] = choice.label;
      entry[this.ITEM_TEXT_FIELD] = choice.label;
      this.dropdownList.push(entry);

      if (choice.selectedByDefault) {
        if (this.component.isMultiPage()) {
          this.selectedItems = entry;
        } else {
          if (this.selectedItems == null) {
            this.selectedItems = [];
          }
          this.selectedItems.push(entry);
        }
      }
    }
    this.inputChanged(null);
  }

}
