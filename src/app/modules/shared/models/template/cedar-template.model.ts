import {TemplateComponent} from './template-component.model';
import {AbstractElementComponent} from '../element/abstract-element-component.model';

export class CedarTemplate extends AbstractElementComponent implements TemplateComponent {

  className = 'CedarTemplate';

  isMulti(): boolean {
    return false;
  }

}
