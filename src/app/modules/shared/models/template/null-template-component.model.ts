import {TemplateComponent} from './template-component.model';
import {CedarComponent} from '../component/cedar-component.model';

export class NullTemplateComponent implements TemplateComponent {

  className = 'NullTemplateComponent';
  name: string;
  public children: CedarComponent[] = null;

}
