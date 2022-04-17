import {TemplateComponent} from '../models/template/template-component.model';
import {ElementComponent} from '../models/component/element-component.model';
import {MultiComponent} from '../models/component/multi-component.model';
import {Injectable} from '@angular/core';
import {MultiFieldComponent} from '../models/field/multi-field-component.model';
import {SingleFieldComponent} from '../models/field/single-field-component.model';
import {MultiElementComponent} from '../models/element/multi-element-component.model';
import {SingleElementComponent} from '../models/element/single-element-component.model';
import {CedarComponent} from '../models/component/cedar-component.model';
import {CedarTemplate} from '../models/template/cedar-template.model';
import * as _ from 'lodash-es';
import {MultiInstanceInfo} from '../models/info/multi-instance-info.model';
import {MultiInstanceObjectInfo} from '../models/info/multi-instance-object-info.model';
import {InstanceExtractData} from '../models/instance-extract-data.model';
import {JavascriptTypes} from '../models/javascript-types.model';
import {JsonSchema} from '../models/json-schema.model';
import {CedarUIComponent} from '../models/ui/cedar-ui-component.model';

@Injectable({
  providedIn: 'root',
})
export class MultiInstanceObjectHandler {

  private multiInstanceObject: MultiInstanceInfo;
  private templateRepresentation: TemplateComponent;


  // private componentPathMap: Map<string, CedarComponent> = new Map<string, CedarComponent>();

  private instanceCountMap: Map<string, number> = new Map<string, number>();



  buildNew(templateRepresentation: TemplateComponent): MultiInstanceInfo {
    this.templateRepresentation = templateRepresentation;
    this.multiInstanceObject = new MultiInstanceInfo();
    this.buildRecursively(templateRepresentation, this.multiInstanceObject);
    return this.multiInstanceObject;
  }



  buildFromMetadata(templateRepresentation: TemplateComponent, instanceExtractData: InstanceExtractData): MultiInstanceInfo {
    // this.templateRepresentation = templateRepresentation;
    // this.multiInstanceObject = new MultiInstanceInfo();
    //
    // console.log('templateRepresentation');
    // console.log(this.templateRepresentation);
    //
    // this.buildRecursively(templateRepresentation, this.multiInstanceObject);


    if (instanceExtractData) {


      // no need to generate component path map because the base multiInstanceObject is already created
      // this.populateComponentPathMap(templateRepresentation);

      // generate metadata names map to the value count

      this.populateInstanceCountMap(instanceExtractData, []);


      console.log('this.instanceCountMap');
      console.log(this.instanceCountMap);

      // iterate over the base multiInstanceObject, updating it using values from metadata names map

      // this.updateFromInstanceExtractData(instanceExtractData, [], this.multiInstanceObject);
    }



    // console.log('componentPathMap');
    // console.log(this.componentPathMap);


    return this.multiInstanceObject;
  }






  private valueCount(obj: object, key: string): number {
    const val = obj[key];

    if (val instanceof Array && val.length > 0) {
      if (
        (typeof val[0] === JavascriptTypes.object && val[0].keys().length === 1 && val[0].keys()[0] === JsonSchema.atValue) ||
        (typeof val[0] === 'string' && val[0].length > 0)
      ) {
        return val.length;
      }
    }
    return 0;
  }





  private populateInstanceCountMap(instanceExtractDataIn: InstanceExtractData, parentPath: string[]): void {
    const instanceExtractData = JSON.parse(JSON.stringify(instanceExtractDataIn));
    this.deleteAttributeValueFields(instanceExtractData);

    for (const key in instanceExtractData) {
      const myPath: string[] = parentPath.slice();
      myPath.push(key.replace('.', ' '));

      // multi-page element or mutli-page field
      if (Array.isArray(instanceExtractData[key]) && instanceExtractData[key].length > 0) {
        this.instanceCountMap.set(myPath.join('.'), instanceExtractData[key].length);

        // field component with values or attribute-value field
        const isField =
          // field component with values (text or controlled)
          (typeof instanceExtractData[key][0] === JavascriptTypes.object &&
          (instanceExtractData[key][0].hasOwnProperty(JsonSchema.atValue) ||
            instanceExtractData[key][0].hasOwnProperty(JsonSchema.atId))) ||
          // attribute-value field
          (typeof instanceExtractData[key][0] === JavascriptTypes.string && instanceExtractData[key].length > 0);

        if (isField) {
          this.instanceCountMap.set(myPath.join('.'), instanceExtractData[key].length);
        } else {
          // multi-page element component
          for (let i = 0; i < instanceExtractData[key].length; i++) {
            if (i > 0) {
              myPath.pop();
            }
            myPath.push(i.toString());
            this.populateInstanceCountMap(instanceExtractData[key][i], myPath);
          }
        }
      // it's an object, can be a single-page element or a single-page field
      } else if (typeof instanceExtractData[key] === JavascriptTypes.object && Object.keys(instanceExtractData[key]).length > 0) {
        // single-page field (it's never paginated, so not really required for pagination, but record it anyway)
        if (instanceExtractData[key].hasOwnProperty(JsonSchema.atValue) ||
          instanceExtractData[key].hasOwnProperty(JsonSchema.atId)) {
          this.instanceCountMap.set(myPath.join('.'), 1);
        } else {
          // single-page element component
          this.populateInstanceCountMap(instanceExtractData[key], myPath);
        }
      } else {
        // nothing really to do here, but keeping the block for now in case it triggers
        console.log('some empty field: ' + instanceExtractData[key]);
      }
    }
  }


  private deleteAttributeValueFields(instanceExtractData: InstanceExtractData): void {
    for (const key in instanceExtractData) {
      if (Array.isArray(instanceExtractData[key]) && instanceExtractData[key].length > 0) {
        if (typeof instanceExtractData[key][0] === JavascriptTypes.string) {
          for (let i = 0; i < instanceExtractData[key].length; i++) {
            delete instanceExtractData[instanceExtractData[key][i]];
          }
        } else {
          if (!instanceExtractData[key][0].hasOwnProperty(JsonSchema.atValue) &&
            !instanceExtractData[key][0].hasOwnProperty(JsonSchema.atId)) {
            for (let i = 0; i < instanceExtractData[key].length; i++) {
              this.deleteAttributeValueFields(instanceExtractData[key][i]);
            }
          }
        }
      } else {
        if (!instanceExtractData[key].hasOwnProperty(JsonSchema.atValue) &&
          !instanceExtractData[key].hasOwnProperty(JsonSchema.atId)) {
          this.deleteAttributeValueFields(instanceExtractData[key]);
        }
      }
    }
  }






  // private populateComponentPathMap(cedarComponent: CedarComponent): void {
  //   if (!(cedarComponent instanceof MultiElementComponent || cedarComponent instanceof SingleElementComponent
  //     || cedarComponent instanceof CedarTemplate)) {
  //     return;
  //   }
  //   const elementComponent = cedarComponent as ElementComponent;
  //
  //   for (const child of elementComponent.children) {
  //     const path = child.path.map(elem => elem.replace('.', ' ')).join('.');
  //     this.componentPathMap.set(path, child);
  //
  //     if (child instanceof MultiElementComponent || child instanceof SingleElementComponent) {
  //       this.populateComponentPathMap(child);
  //     }
  //   }
  // }




  private buildRecursively(cedarComponent: CedarComponent, multiInstanceObject: MultiInstanceInfo): void {
    if (!(cedarComponent instanceof MultiElementComponent || cedarComponent instanceof SingleElementComponent
      || cedarComponent instanceof CedarTemplate)) {
      return;
    }
    const elementComponent = cedarComponent as ElementComponent;
    for (const child of elementComponent.children) {
      const name = child.name;
      const multiInfo = new MultiInstanceObjectInfo();
      multiInfo.componentName = name;
      multiInstanceObject.addChild(multiInfo);
      let count = 0;
      let currentIndex = -1;
      if (child instanceof MultiFieldComponent) {
        count = (child as MultiComponent).multiInfo.minItems;
        currentIndex = count > 0 ? 0 : -1;
        delete multiInfo.children;
      } else if (child instanceof SingleFieldComponent) {
        count = 1;
        currentIndex = -1;
        delete multiInfo.children;
      } else if (child instanceof MultiElementComponent) {
        count = (child as MultiComponent).multiInfo.minItems;
        currentIndex = count > 0 ? 0 : -1;
        for (let i = 0; i < count; i++) {
          const mc = new MultiInstanceInfo();
          this.buildRecursively(child, mc);
          multiInfo.addChild(mc);
        }
      } else if (child instanceof SingleElementComponent) {
        count = 1;
        currentIndex = -1;
        const mc = new MultiInstanceInfo();
        this.buildRecursively(child, mc);
        multiInfo.addChild(mc);
      }
      multiInfo.currentCount = count;
      multiInfo.currentIndex = currentIndex;
    }
  }

  setCurrentIndex(component: MultiComponent, currentIdx: number): void {
    const multiInstanceInfo: MultiInstanceObjectInfo = this.getDataPathNode(component.path);
    multiInstanceInfo.currentIndex = currentIdx;
  }

  multiInstanceItemAdd(component: MultiComponent): void {
    const multiInstanceInfo: MultiInstanceObjectInfo = this.getDataPathNode(component.path);

    if (component instanceof MultiElementComponent) {
      const newMultiInstanceObject: MultiInstanceInfo = new MultiInstanceInfo();
      this.buildRecursively(component, newMultiInstanceObject);
      multiInstanceInfo.children.splice(multiInstanceInfo.currentIndex + 1, 0, newMultiInstanceObject as never);
    }

    multiInstanceInfo.currentIndex++;
    multiInstanceInfo.currentCount++;
  }

  multiInstanceItemCopy(component: MultiComponent): void {
    const multiInstanceInfo = this.getDataPathNode(component.path);

    if (component instanceof MultiElementComponent) {
      const currentIdx = multiInstanceInfo.currentIndex;
      const sourceItem = multiInstanceInfo.children[currentIdx];
      const cloneItem = _.cloneDeep(sourceItem as any);
      multiInstanceInfo.children.splice(currentIdx + 1, 0, cloneItem as never);
    }

    multiInstanceInfo.currentIndex++;
    multiInstanceInfo.currentCount++;
  }

  multiInstanceItemDelete(component: MultiComponent): void {
    const multiInstanceInfo = this.getDataPathNode(component.path);

    if (component instanceof MultiElementComponent) {
      const currentIdx = multiInstanceInfo.currentIndex;
      multiInstanceInfo.children.splice(currentIdx, 1);
    }
    multiInstanceInfo.currentCount--;
    if (multiInstanceInfo.currentIndex > multiInstanceInfo.currentCount - 1) {
      multiInstanceInfo.currentIndex = multiInstanceInfo.currentCount - 1;
    }
  }

  getMultiInstanceInfoForComponent(component: MultiComponent): MultiInstanceObjectInfo {
    return this.getDataPathNode(component.path);
  }

  public getDataPathNode(path: string[]): MultiInstanceObjectInfo {
    return this.getDataPathNodeRecursively(this.multiInstanceObject, this.templateRepresentation, path);
  }

  private getDataPathNodeRecursively(multiInstanceObject: MultiInstanceInfo, component: CedarComponent, path: string[]): MultiInstanceObjectInfo {
    const firstPath = path[0];
    const remainingPath = path.slice(1);
    let childComponent: CedarComponent = null;
    let childMultiInfo: MultiInstanceObjectInfo = null;
    if (component instanceof SingleElementComponent) {
      childComponent = (component as SingleElementComponent).getChildByName(firstPath);
      childMultiInfo = multiInstanceObject.getChildByName(firstPath);
    } else if (component instanceof CedarTemplate) {
      childComponent = (component as CedarTemplate).getChildByName(firstPath);
      childMultiInfo = multiInstanceObject.getChildByName(firstPath);
    } else if (component instanceof MultiElementComponent) {
      childComponent = (component as MultiElementComponent).getChildByName(firstPath);
      childMultiInfo = multiInstanceObject.getChildByName(firstPath);
    }
    if (remainingPath.length === 0) {
      return childMultiInfo;
    } else {
      let goIdx = 0;
      if (childMultiInfo.currentIndex > 0) {
        goIdx = childMultiInfo.currentIndex;
      }
      return this.getDataPathNodeRecursively(childMultiInfo.children[goIdx], childComponent, remainingPath);
    }
  }

  hasMultiInstances(multiComponent: MultiComponent): boolean {
    const multiInstanceObjectInfo: MultiInstanceObjectInfo = this.getMultiInstanceInfoForComponent(multiComponent);
    return multiInstanceObjectInfo.currentCount > 0;
  }
}
