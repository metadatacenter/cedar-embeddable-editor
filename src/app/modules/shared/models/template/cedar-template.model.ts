import {CedarComponent} from '../component/cedar-component.model';
import {TemplateComponent} from './template-component.model';

export class CedarTemplate implements TemplateComponent {

  className = 'CedarTemplate';
  name: string;
  public children: CedarComponent[] = [];

}
