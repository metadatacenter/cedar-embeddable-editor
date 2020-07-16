import {ComponentsWrapper} from './components-wrapper.model';
import {ComponentRepresentation} from '../component/component-representation.model';

export class RegularComponentsWrapper implements ComponentsWrapper {

  public components: ComponentRepresentation[];

  constructor() {
    this.components = [];
  }

}
