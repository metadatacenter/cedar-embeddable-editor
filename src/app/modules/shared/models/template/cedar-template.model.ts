import {TemplateComponent} from './template-component.model';
import {AbstractElementComponent} from '../element/abstract-element-component.model';
import {CedarComponent} from '../component/cedar-component.model';
import {DataObjectUtil} from '../../util/data-object-util';

export class CedarTemplate extends AbstractElementComponent implements TemplateComponent {

  className = 'CedarTemplate';
  pageBreakChildren: Array<CedarComponent[]>;


  hasPageBreaks(): boolean {
    return !DataObjectUtil.arraysEqual(this.children, this.pageBreakChildren[0]);
  }

  isMulti(): boolean {
    return false;
  }

  isMultiPage(): boolean {
    return false;
  }

}
