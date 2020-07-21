import {TemplateComponent} from './template-component.model';
import {CedarComponent} from '../component/cedar-component.model';
import {LabelInfo} from '../info/label-info.model';

export class NullTemplateComponent implements TemplateComponent {

  className = 'NullTemplateComponent';
  name: string;
  public children: CedarComponent[] = null;
  labelInfo: LabelInfo = null;

}
