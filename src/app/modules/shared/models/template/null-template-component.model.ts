import {TemplateComponent} from './template-component.model';
import {AbstractElementComponent} from '../element/abstract-element-component.model';
import {DataObjectService} from '../../service/data-object.service';

export class NullTemplateComponent extends AbstractElementComponent implements TemplateComponent {

  className = 'NullTemplateComponent';

  isMulti(): boolean {
    return false;
  }

  updateUIComponentToModel(dataObjectService: DataObjectService): void {
  }

}
