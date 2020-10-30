import {TemplateComponent} from './template-component.model';
import {AbstractElementComponent} from '../element/abstract-element-component.model';
import {DataObjectService} from '../../service/data-object.service';

export class CedarTemplate extends AbstractElementComponent implements TemplateComponent {

  className = 'CedarTemplate';

  isMulti(): boolean {
    return false;
  }

  updateUIComponentToModel(dataObjectService: DataObjectService): void {
  }

}
