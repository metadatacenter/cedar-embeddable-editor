import {TemplateRepresentation} from './template-representation.model';
import {ComponentsWrapper} from './components-wrapper.model';
import {NullComponentsWrapper} from './null-components-wrapper.model';

export class NullTemplateRepresentation implements TemplateRepresentation {

  public componentsWrapper: ComponentsWrapper;

  constructor() {
    this.componentsWrapper = new NullComponentsWrapper();
  }

}
