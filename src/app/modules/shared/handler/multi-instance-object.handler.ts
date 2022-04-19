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



  public multiInstanceObject: MultiInstanceInfo;




  private templateRepresentation: TemplateComponent;


  // private componentPathMap: Map<string, CedarComponent> = new Map<string, CedarComponent>();

  // private instanceCountMap: Map<string, number> = new Map<string, number>();


  // private instanceCountMap: Map<string[], number> = new Map<string[], number>();



  private indexRegEx = new RegExp(/@#index\[(\d+)\]#@/);





  private static getNodeByPath(obj, arrPath: string[]): object {
    let val: object;

    for (let i = 0; i < arrPath.length; i++) {
      if (val) {
        val = val[arrPath[i]];
      } else {
        val = obj[arrPath[i]];
      }
    }
    return val;
  }

  private static getMultiInstanceInfoNodeByPath(obj, arrPath: string[]): MultiInstanceInfo {
    return MultiInstanceObjectHandler.getNodeByPath(obj, arrPath) as MultiInstanceInfo;
  }

  private static getMultiInstanceObjectInfoNodeByPath(obj, arrPath: string[]): MultiInstanceObjectInfo {
    return MultiInstanceObjectHandler.getNodeByPath(obj, arrPath) as MultiInstanceObjectInfo;
  }





  buildNew(templateRepresentation: TemplateComponent): MultiInstanceInfo {
    this.templateRepresentation = templateRepresentation;
    this.multiInstanceObject = new MultiInstanceInfo();
    this.buildRecursively(templateRepresentation, this.multiInstanceObject);
    return this.multiInstanceObject;
  }



  buildFromMetadata(templateRepresentation: TemplateComponent, instanceExtractData: InstanceExtractData): MultiInstanceInfo {
    this.templateRepresentation = templateRepresentation;
    this.multiInstanceObject = new MultiInstanceInfo();
    this.buildRecursively(templateRepresentation, this.multiInstanceObject);



    // console.log('bare multiInstanceObject');
    // console.log(JSON.stringify(this.multiInstanceObject, null, 2));



    if (instanceExtractData) {


      this.populateMultiInstanceObject(instanceExtractData, [], this.multiInstanceObject);


      // console.log('this.instanceCountMap');
      // console.log(this.instanceCountMap);
      // for (const [key, value] of this.instanceCountMap) {
      //   console.log(key + ' => ' + value);
      // }

      // iterate over the base multiInstanceObject, updating it using values from metadata names map

      // this.updateFromInstanceExtractData(instanceExtractData, [], this.multiInstanceObject);
    }



    // console.log('componentPathMap');
    // console.log(this.componentPathMap);


    return this.multiInstanceObject;
  }







  private populateMultiInstanceObject(instanceExtractDataIn: InstanceExtractData,
                                      parentPath: string[], multiInstanceObject: MultiInstanceInfo): void {
    const instanceExtractData = JSON.parse(JSON.stringify(instanceExtractDataIn));
    this.deleteAttributeValueFields(instanceExtractData);




    for (const key in instanceExtractData) {
      const myPath: string[] = parentPath.slice();
      myPath.push(key);



      // multi-page element or mutli-page field
      if (Array.isArray(instanceExtractData[key]) && instanceExtractData[key].length > 0) {




        // this.instanceCountMap.set(myPath.slice(), instanceExtractData[key].length);

        console.log('myPath');
        console.log(myPath.slice());
        console.log('instanceExtractData[key].length');
        console.log(instanceExtractData[key].length);




        this.setSingleMultiInstance(myPath.slice(), instanceExtractData[key].length, multiInstanceObject);



        // field component with values or attribute-value field
        const isField =
          // field component with values (text or controlled)
          (typeof instanceExtractData[key][0] === JavascriptTypes.object &&
            (instanceExtractData[key][0].hasOwnProperty(JsonSchema.atValue) ||
              instanceExtractData[key][0].hasOwnProperty(JsonSchema.atId))) ||
          // attribute-value field
          (typeof instanceExtractData[key][0] === JavascriptTypes.string && instanceExtractData[key].length > 0);

        if (isField) {

          // nothing so far




        } else {
          // multi-page element component
          for (let i = 0; i < instanceExtractData[key].length; i++) {
            if (i > 0) {
              myPath.pop();
            }


            myPath.push(this.indexRegEx.source.replace('(\\d+)', i.toString()).replace(/\\/g, ''));
            this.populateMultiInstanceObject(instanceExtractData[key][i], myPath, multiInstanceObject);


          }
        }
        // it's an object, can be a single-page element or a single-page field
      } else if (typeof instanceExtractData[key] === JavascriptTypes.object && Object.keys(instanceExtractData[key]).length > 0) {
        // single-page field (it's never paginated, so not really required for pagination, but record it anyway)
        if (instanceExtractData[key].hasOwnProperty(JsonSchema.atValue) ||
          instanceExtractData[key].hasOwnProperty(JsonSchema.atId)) {



          // this.instanceCountMap.set(myPath, 1);

          // this.setSingleMultiInstance(myPath, 1, multiInstanceObject);



        } else {
          // single-page element component

          // push a dummy 0 array element for a consistent multi-paging logic
          // multi-page structure does not differentiate between single- and multi-page components
          myPath.push(this.indexRegEx.source.replace('(\\d+)', '0').replace(/\\/g, ''));
          this.populateMultiInstanceObject(instanceExtractData[key], myPath, multiInstanceObject);
        }
      } else {
        // nothing really to do here, empty fields
        console.log('some empty field: ' + key);
      }
    }
  }




  private setSingleMultiInstance1(path: string[], count: number,
                                  multiInstanceObject: MultiInstanceInfo): void {
    const pathCopy = [];

    for (let i = 0; i < path.length; i++) {
      pathCopy.push(path[i]);
      const match = path[i].match(this.indexRegEx);


      // this means we need to add a child
      if (match && match.length > 1) {
        pathCopy.pop();
        pathCopy.push('children');
        pathCopy.push(match[1]);
      }
    }
    const componentName = path[path.length - 1];
    const namePath = pathCopy.slice();
    namePath.push('componentName');
    const countPath = pathCopy.slice();
    countPath.push('currentCount');
    const indexPath = pathCopy.slice();
    indexPath.push('currentIndex');

    this.setObject(this.multiInstanceObject, namePath, componentName);
    this.setObject(this.multiInstanceObject, countPath, count);
    this.setObject(this.multiInstanceObject, indexPath, 0);
  }





  private setSingleMultiInstance(path: string[], count: number,
                                 multiInstanceObject: MultiInstanceInfo): void {

    console.log('path');
    console.log(path);


    const pathCopy = [];






    for (let i = 0; i < path.length; i++) {
      pathCopy.push(path[i]);
      const match = path[i].match(this.indexRegEx);

      if (match && match.length > 1) {
        pathCopy.pop();
        const pathParent = pathCopy.slice();
        const parentObj = MultiInstanceObjectHandler.getMultiInstanceObjectInfoNodeByPath(multiInstanceObject, pathParent);


        console.log('pathParent');
        console.log(pathParent);
        console.log('parentObj');
        console.log(parentObj);


        pathCopy.push('children');
        pathCopy.push(match[1]);

        const childObj = MultiInstanceObjectHandler.getMultiInstanceInfoNodeByPath(multiInstanceObject, pathCopy);


        console.log('pathChild');
        console.log(pathCopy);
        console.log('childObj');
        console.log(childObj);


        // childObj is an object of type MultiInstanceInfo of structure
        // {strKey1 => MultiInstanceObjectInfo, strKey2 => MultiInstanceObjectInfo}

        const componentName = path[i + 1];

        if (childObj) {
          const arrayElemPath = pathCopy.slice();
          arrayElemPath.push(componentName);

          console.log('targetPath');
          console.log(arrayElemPath);

          const arrayElem = MultiInstanceObjectHandler.getMultiInstanceObjectInfoNodeByPath(multiInstanceObject, arrayElemPath);

          console.log('arrayElem');
          console.log(arrayElem);

          if (!arrayElem) {
            const childElem = new MultiInstanceObjectInfo();
            childElem.componentName = componentName;
            childObj.addChild(childElem);
          }


        } else {

          console.log('child is null, adding...');
          const child = new MultiInstanceInfo();
          parentObj.addChild(child);
          const childElem = new MultiInstanceObjectInfo();
          childElem.componentName = componentName;
          child.addChild(childElem);

        }




      }
    }

    console.log('path processed');
    console.log(pathCopy);

    const targetObj = MultiInstanceObjectHandler.getMultiInstanceObjectInfoNodeByPath(multiInstanceObject, pathCopy);

    console.log('targetObj');
    console.log(targetObj);
    console.log('---------------------------');


    targetObj.componentName = path[path.length - 1];
    targetObj.currentCount = count;
    targetObj.currentIndex = 0;






    // const componentName = path[path.length - 1];
    // const namePath = pathCopy.slice();
    // namePath.push('componentName');
    // const countPath = pathCopy.slice();
    // countPath.push('currentCount');
    // const indexPath = pathCopy.slice();
    // indexPath.push('currentIndex');

    // this.setObject(this.multiInstanceObject, namePath, componentName);
    // this.setObject(this.multiInstanceObject, countPath, count);
    // this.setObject(this.multiInstanceObject, indexPath, 0);
  }









  private setObject = (obj, keysIn, val) => {
    const keys = keysIn.slice();
    const lastKey = keys.pop();
    const lastObj = keys.reduce((obj, key) => obj[key] = obj[key] || {}, obj);
    lastObj[lastKey] = val;
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


      // console.log('multiInstanceObject');
      // console.log(multiInstanceObject);


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
