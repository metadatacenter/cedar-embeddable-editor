import {TemplateRepresentation} from './template-representation.model';
import {ComponentsWrapper} from '../components-wrapper/components-wrapper.model';
import {RegularComponentsWrapper} from '../components-wrapper/regular-components-wrapper.model';

export class RegularTemplateRepresentation implements TemplateRepresentation {

  public componentsWrapper: ComponentsWrapper;

  constructor() {
    this.componentsWrapper = new RegularComponentsWrapper();
  }

}
