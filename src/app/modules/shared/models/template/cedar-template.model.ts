import {CedarComponent} from '../component/cedar-component.model';
import {TemplateComponent} from './template-component.model';
import {LabelInfo} from '../info/label-info.model';

export class CedarTemplate implements TemplateComponent {

  className = 'CedarTemplate';
  name: string;
  public children: CedarComponent[] = [];
  labelInfo: LabelInfo = new LabelInfo();

}
