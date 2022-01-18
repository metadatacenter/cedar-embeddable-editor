import {TemplateComponent} from './template-component.model';
import {AbstractElementComponent} from '../element/abstract-element-component.model';
import {CedarComponent} from '../component/cedar-component.model';

export class NullTemplateComponent extends AbstractElementComponent implements TemplateComponent {

  className = 'NullTemplateComponent';
  pageBreakChildren: Array<CedarComponent[]>;


  hasPageBreaks(): boolean {
    return false;
  }

  isMulti(): boolean {
    return false;
  }

  isMultiPage(): boolean {
    return false;
  }

}
