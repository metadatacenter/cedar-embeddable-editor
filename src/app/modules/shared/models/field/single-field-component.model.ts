import {FieldComponent} from '../component/field-component.model';
import {SingleComponent} from '../component/single-component.model';
import {AbstractFieldComponent} from './abstract-field-component.model';
import {DataObjectService} from '../../service/data-object.service';
import {JsonSchema} from '../json-schema.model';

export class SingleFieldComponent extends AbstractFieldComponent implements SingleComponent, FieldComponent {

  className = 'SingleFieldComponent';

  isMulti(): boolean {
    return false;
  }

  public updateUIComponentToModel(dataObjectService: DataObjectService): void {
    // console.log('SingleFieldComponent.updateUIComponentToModel');
    const dataObject: object = dataObjectService.getDataPathNode(this.path);
    if (this.uiComponent != null && dataObject != null) {
      this.uiComponent.setCurrentValue(dataObject[JsonSchema.atValue]);
    }
  }

}
