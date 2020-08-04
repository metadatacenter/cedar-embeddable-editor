import {TemplateComponent} from '../models/template/template-component.model';
import {CedarComponent} from '../models/component/cedar-component.model';
import {SingleElementComponent} from '../models/element/single-element-component.model';
import {MultiElementComponent} from '../models/element/multi-element-component.model';
import {CedarTemplate} from '../models/template/cedar-template.model';
import {ElementComponent} from '../models/component/element-component.model';
import {SingleFieldComponent} from '../models/field/single-field-component.model';
import {MultiFieldComponent} from '../models/field/multi-field-component.model';
import {FieldComponent} from '../models/component/field-component.model';

export class DataObjectService {

  buildNew(templateRepresentation: TemplateComponent): object {
    const dataObject = {};
    if (templateRepresentation != null && templateRepresentation.children != null) {
      for (const childComponent of templateRepresentation.children) {
        this.buildRecursively(childComponent, dataObject);
      }
    }
    return dataObject;
  }

  private buildRecursively(component: CedarComponent, dataObject: object): void {
    let ret = null;
    if (component instanceof SingleElementComponent || component instanceof MultiElementComponent || component instanceof CedarTemplate) {
      const iterableComponent: ElementComponent = component as ElementComponent;
      const targetName = iterableComponent.name;
      if (component instanceof MultiElementComponent) {
        const multiInfo = (component as MultiElementComponent).multiInfo;
        dataObject[targetName] = this.getEmptyList();
        if (multiInfo.minItems > 0) {
          const dummyTargetObject: object = this.getEmptyObject();
          for (const childComponent of iterableComponent.children) {
            this.buildRecursively(childComponent, dummyTargetObject);
          }
          for (let idx = 0; idx < multiInfo.minItems; idx++) {
            dataObject[targetName].push(Object.assign({}, dummyTargetObject));
          }
        }
      } else {
        dataObject[targetName] = this.getEmptyObject();
        for (const childComponent of iterableComponent.children) {
          this.buildRecursively(childComponent, dataObject[targetName]);
        }
      }
      ret = dataObject[targetName];
    }
    if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
      const nonIterableComponent = component as FieldComponent;
      const targetName = nonIterableComponent.name;
      if (component instanceof MultiFieldComponent) {
        const multiInfo = (component as MultiFieldComponent).multiInfo;
        dataObject[targetName] = this.getEmptyList();
        if (multiInfo.minItems > 0) {
          for (let idx = 0; idx < multiInfo.minItems; idx++) {
            dataObject[targetName].push(this.getEmptyValueWrapper());
          }
        }
      } else {
        dataObject[targetName] = this.getEmptyValueWrapper();
      }
      ret = dataObject[targetName];
    }
    return ret;
  }

  private getEmptyValueWrapper(): object {
    return {
      '@value': ''
    };
  }

  private getEmptyObject(): object {
    return {};
  }

  private getEmptyList(): [] {
    return [];
  }
}
