import * as _ from 'lodash-es';
import { MultiComponent } from '../models/component/multi-component.model';
import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { DataContext } from '../util/data-context';
import { MultiInstanceObjectHandler } from './multi-instance-object.handler';
import { DataObjectBuilderHandler } from './data-object-builder.handler';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import { CedarInputTemplate } from '../models/cedar-input-template.model';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { TemplateComponent } from '../models/template/template-component.model';

export class DataObjectStructureHandler {
  public getDataPathNodeRecursively(
    dataObject: InstanceExtractData,
    component: CedarComponent,
    path: string[],
    multiInstanceObjectService: MultiInstanceObjectHandler,
    depth = 0,
  ): object {
    if (path.length === 0) {
      return dataObject;
    } else {
      const firstPath = path[0];
      const remainingPath = path.slice(1);
      let childComponent: CedarComponent = null;
      let dataSubObject = null;
      if (component instanceof SingleElementComponent) {
        childComponent = (component as SingleElementComponent).getChildByName(firstPath);
        if (dataObject !== null && dataObject !== undefined) {
          dataSubObject = dataObject[firstPath];
        }
      } else if (component instanceof CedarTemplate) {
        childComponent = (component as CedarTemplate).getChildByName(firstPath);
        if (dataObject !== null && dataObject !== undefined) {
          dataSubObject = dataObject[firstPath];
        }
      } else if (component instanceof MultiElementComponent) {
        const multiElement = component as MultiElementComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo =
          multiInstanceObjectService.getMultiInstanceInfoForComponent(multiElement);

        if (!multiInstanceInfo) {
          return null;
        }
        const currentIndex = multiInstanceInfo.currentIndex;
        childComponent = multiElement.getChildByName(firstPath);
        if (dataObject !== null && dataObject !== undefined) {
          if (Object.hasOwn(dataObject, currentIndex)) {
            dataSubObject = dataObject[currentIndex][firstPath];
          }
        }
      }
      return this.getDataPathNodeRecursively(
        dataSubObject,
        childComponent,
        remainingPath,
        multiInstanceObjectService,
        depth + 1,
      );
    }
  }

  public getParentDataPathNodeRecursively(
    dataObject: InstanceExtractData,
    parentDataObject: InstanceExtractData,
    component: CedarComponent,
    path: string[],
    multiInstanceObjectService: MultiInstanceObjectHandler,
  ): object {
    if (path.length === 0) {
      return parentDataObject;
    } else {
      const firstPath = path[0];
      const remainingPath = path.slice(1);
      let childComponent: CedarComponent = null;
      let dataSubObject = null;
      let parentDataSubObject = null;

      if (component instanceof SingleElementComponent) {
        childComponent = (component as SingleElementComponent).getChildByName(firstPath);
        dataSubObject = dataObject[firstPath];
        parentDataSubObject = dataObject;
      } else if (component instanceof CedarTemplate) {
        childComponent = (component as CedarTemplate).getChildByName(firstPath);
        dataSubObject = dataObject[firstPath];
        parentDataSubObject = dataObject;
      } else if (component instanceof MultiElementComponent) {
        const multiElement = component as MultiElementComponent;
        const multiInstanceInfo: MultiInstanceObjectInfo =
          multiInstanceObjectService.getMultiInstanceInfoForComponent(multiElement);
        const currentIndex = multiInstanceInfo.currentIndex;

        if (currentIndex < 0) {
          return null;
        }
        childComponent = multiElement.getChildByName(firstPath);
        dataSubObject = dataObject[currentIndex][firstPath];
        parentDataSubObject = dataObject[currentIndex];
      }
      return this.getParentDataPathNodeRecursively(
        dataSubObject,
        parentDataSubObject,
        childComponent,
        remainingPath,
        multiInstanceObjectService,
      );
    }
  }

  multiInstanceItemAdd(
    dataContext: DataContext,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
  ): void {
    const multiInstanceInfo: MultiInstanceObjectInfo =
      multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
    const instanceExtractData: object = dataContext.instanceExtractData;
    const instanceFullData: object = dataContext.instanceFullData;
    const templateRepresentation: TemplateComponent = dataContext.templateRepresentation;
    const templateInput: CedarInputTemplate = dataContext.templateInput;

    this.performItemAdd(
      instanceExtractData,
      templateRepresentation,
      component,
      multiInstanceObjectService,
      multiInstanceInfo,
      templateInput,
    );
    this.performItemAdd(
      instanceFullData,
      templateRepresentation,
      component,
      multiInstanceObjectService,
      multiInstanceInfo,
      templateInput,
    );
  }

  private performItemAdd(
    instanceObject: InstanceExtractData,
    templateRepresentation: TemplateComponent,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    multiInstanceInfo: MultiInstanceObjectInfo,
    templateInput: CedarInputTemplate,
  ): void {
    const dataObject = {};
    const cloneComponent = _.cloneDeep(component);
    DataObjectBuilderHandler.setCurrentCountToMinRecursively(cloneComponent, component.path);
    let subTemplate = null;
    if (templateInput != null) {
      const shorterPath = component.path.slice(0, component.path.length - 1);
      subTemplate = DataObjectBuilderHandler.getSubTemplate(templateInput, shorterPath);
    }
    DataObjectBuilderHandler.buildRecursively(
      cloneComponent,
      dataObject,
      subTemplate,
      DataObjectBuildingMode.INCLUDE_CONTEXT,
    );
    const newDataObject = dataObject[component.name][0];
    const currentNodeAny = this.getDataPathNodeRecursively(
      instanceObject,
      templateRepresentation,
      component.path,
      multiInstanceObjectService,
    );
    const currentNodeArray = currentNodeAny as [];
    currentNodeArray.splice(multiInstanceInfo.currentIndex + 1, 0, newDataObject as never);
  }

  multiInstanceItemCopy(
    dataContext: DataContext,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
  ): void {
    const multiInstanceInfo: MultiInstanceObjectInfo =
      multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
    const instanceExtractData: object = dataContext.instanceExtractData;
    const instanceFullData: object = dataContext.instanceFullData;
    const templateRepresentation: TemplateComponent = dataContext.templateRepresentation;
    this.performItemCopy(
      instanceExtractData,
      templateRepresentation,
      component.path,
      multiInstanceObjectService,
      multiInstanceInfo,
    );
    this.performItemCopy(
      instanceFullData,
      templateRepresentation,
      component.path,
      multiInstanceObjectService,
      multiInstanceInfo,
    );
  }

  private performItemCopy(
    instanceObject: InstanceExtractData,
    templateRepresentation: TemplateComponent,
    path: string[],
    multiInstanceObjectService: MultiInstanceObjectHandler,
    multiInstanceInfo: MultiInstanceObjectInfo,
  ): void {
    const currentNodeAny = this.getDataPathNodeRecursively(
      instanceObject,
      templateRepresentation,
      path,
      multiInstanceObjectService,
    );
    const currentNodeArray = currentNodeAny as [];
    const sourceItem = currentNodeArray[multiInstanceInfo.currentIndex];
    const cloneItem = _.cloneDeep(sourceItem as any);
    currentNodeArray.splice(multiInstanceInfo.currentIndex + 1, 0, cloneItem as never);
  }

  multiInstanceItemDelete(
    dataContext: DataContext,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
  ): void {
    const multiInstanceInfo: MultiInstanceObjectInfo =
      multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
    const instanceExtractData: object = dataContext.instanceExtractData;
    const instanceFullData: object = dataContext.instanceFullData;
    const templateRepresentation: TemplateComponent = dataContext.templateRepresentation;
    this.performItemDelete(
      instanceExtractData,
      templateRepresentation,
      component.path,
      multiInstanceObjectService,
      multiInstanceInfo,
    );
    this.performItemDelete(
      instanceFullData,
      templateRepresentation,
      component.path,
      multiInstanceObjectService,
      multiInstanceInfo,
    );
  }

  private performItemDelete(
    instanceObject: InstanceExtractData,
    templateRepresentation: TemplateComponent,
    path: string[],
    multiInstanceObjectService: MultiInstanceObjectHandler,
    multiInstanceInfo: MultiInstanceObjectInfo,
  ): void {
    const currentNodeAny = this.getDataPathNodeRecursively(
      instanceObject,
      templateRepresentation,
      path,
      multiInstanceObjectService,
    );
    const currentNodeArray = currentNodeAny as [];
    currentNodeArray.splice(multiInstanceInfo.currentIndex, 1);
  }
}
