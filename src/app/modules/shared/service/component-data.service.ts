import {FieldComponent} from '../models/component/field-component.model';
import {ElementComponent} from '../models/component/element-component.model';

export class ComponentDataService {

  public getRenderingLabelForField(component: FieldComponent): string {
    if (component.labelInfo !== undefined &&
      component.labelInfo.preferredLabel !== undefined &&
      component.labelInfo.preferredLabel !== null) {
      return component.labelInfo.preferredLabel;
    }
    if (component.labelInfo !== undefined &&
      component.labelInfo.label !== undefined &&
      component.labelInfo.label !== null) {
      return component.labelInfo.label;
    }
    if (component.name !== null) {
      return component.name;
    }
  }

  public getRenderingLabelForElement(component: ElementComponent): string {
    if (component.labelInfo !== undefined &&
      component.labelInfo.preferredLabel !== undefined &&
      component.labelInfo.preferredLabel !== null) {
      return component.labelInfo.preferredLabel;
    }
    if (component.labelInfo !== undefined &&
      component.labelInfo.label !== undefined &&
      component.labelInfo.label !== null) {
      return component.labelInfo.label;
    }
    if (component.name !== null) {
      return component.name;
    }
  }

}
