import {CedarComponent} from '../models/component/cedar-component.model';
import {SingleFieldComponent} from '../models/field/single-field-component.model';
import {MultiFieldComponent} from '../models/field/multi-field-component.model';
import {StaticFieldComponent} from '../models/static/static-field-component.model';
import {InputType} from '../models/input-type.model';
import {CedarTemplate} from '../models/template/cedar-template.model';
import {SingleElementComponent} from '../models/element/single-element-component.model';
import {MultiElementComponent} from '../models/element/multi-element-component.model';

export class ComponentTypeHandler {

  public static isImage(component: CedarComponent): boolean {
    return component instanceof StaticFieldComponent && component.basicInfo.inputType === InputType.image;
  }

  static isYoutube(component: CedarComponent): boolean {
    return component instanceof StaticFieldComponent && component.basicInfo.inputType === InputType.youtube;
  }

  public static isRichText(component: CedarComponent): boolean {
    return component instanceof StaticFieldComponent && component.basicInfo.inputType === InputType.richText;
  }

  public static isStaticContentComponent(component: CedarComponent): boolean {
    return this.isImage(component) || this.isYoutube(component) || this.isRichText(component);
  }

  public static isField(component: CedarComponent): boolean {
    return component instanceof SingleFieldComponent || component instanceof MultiFieldComponent;
  }

  public static isElement(component: CedarComponent): boolean {
    return component instanceof SingleElementComponent || component instanceof MultiElementComponent;
  }

  static isContainerComponent(component: CedarComponent): boolean {
    return component instanceof CedarTemplate || component instanceof SingleElementComponent || component instanceof MultiElementComponent;
  }

  static isTemplate(component: CedarComponent): boolean {
    return component instanceof CedarTemplate;
  }

  static isFieldOrElement(component: CedarComponent): boolean {
    return this.isField(component) || this.isElement(component);
  }

  static isMulti(component: CedarComponent): boolean {
    return component instanceof MultiFieldComponent || component instanceof MultiElementComponent;
  }
}
