import {TemplateRepresentation} from './template-representation.model';
import {ComponentsWrapper} from '../components-wrapper/components-wrapper.model';
import {NullComponentsWrapper} from '../components-wrapper/null-components-wrapper.model';

export class NullTemplateRepresentation implements TemplateRepresentation {

  public componentsWrapper: ComponentsWrapper;

  constructor() {
    this.componentsWrapper = new NullComponentsWrapper();
  }

}
