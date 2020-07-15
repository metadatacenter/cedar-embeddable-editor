import {ComponentsWrapper} from './components-wrapper.model';
import {ComponentRepresentation} from './component-representation.model';

export class NullComponentsWrapper implements ComponentsWrapper {

  public components: ComponentRepresentation[];

  constructor() {
    this.components = [];
  }

}
