import {CedarComponent} from './cedar-component.model';

export interface ElementComponent extends CedarComponent {

  children: CedarComponent[];

}
