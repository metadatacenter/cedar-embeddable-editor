import * as _ from 'lodash-es';
import { MultiComponent } from '../models/component/multi-component.model';
import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { DataContext } from '../util/data-context';
import { MultiInstanceObjectHandler } from './multi-instance-object.handler';
import { OccurrenceSelector, OccurrenceSelectors } from './occurrence-selector';
import { DataObjectBuilderHandler } from './data-object-builder.handler';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import { CedarInputTemplate } from '../models/cedar-input-template.model';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { TemplateComponent } from '../models/template/template-component.model';
import { DataObjectUtil } from '../util/data-object-util';
import { MessageHandlerService } from '../service/message-handler.service';
import { JsonSchema } from 'cedar-model-typescript-library';

export class DataObjectStructureHandler {
  /**
   * The node a component path points at, given a choice of occurrence at each
   * multi ancestor.
   *
   * `selectOccurrence` makes that choice. It used to be made here, by reading
   * each ancestor's `currentIndex` off the multi-instance service — so this
   * returned different nodes at different times with nothing in the signature
   * saying so, and every caller was silently order-dependent on a cursor
   * mutation. See `OccurrenceSelector`.
   */
  public getDataPathNodeRecursively(
    dataObject: InstanceExtractData,
    component: CedarComponent,
    path: string[],
    selectOccurrence: OccurrenceSelector,
    depth = 0,
  ): InstanceExtractData {
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
        const occurrence = selectOccurrence(multiElement);

        if (occurrence === null) {
          return null;
        }
        childComponent = multiElement.getChildByName(firstPath);
        if (dataObject !== null && dataObject !== undefined) {
          if (Object.hasOwn(dataObject, occurrence)) {
            dataSubObject = dataObject[occurrence][firstPath];
          }
        }
      }
      return this.getDataPathNodeRecursively(
        dataSubObject,
        childComponent,
        remainingPath,
        selectOccurrence,
        depth + 1,
      );
    }
  }

  /**
   * The object *containing* the node a path points at, same rules.
   *
   * The attribute-value widget and the pager need this: an attribute's value
   * lives on the enclosing object under the attribute's own name, not under the
   * field's. It walks the same occurrences, so it takes the same selector — the
   * two had to change together or they would disagree about which occurrence a
   * path meant.
   */
  public getParentDataPathNodeRecursively(
    dataObject: InstanceExtractData,
    parentDataObject: InstanceExtractData,
    component: CedarComponent,
    path: string[],
    selectOccurrence: OccurrenceSelector,
  ): InstanceExtractData {
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
        const occurrence = selectOccurrence(multiElement);

        if (occurrence === null || occurrence < 0) {
          return null;
        }
        childComponent = multiElement.getChildByName(firstPath);
        dataSubObject = dataObject[occurrence][firstPath];
        parentDataSubObject = dataObject[occurrence];
      }
      return this.getParentDataPathNodeRecursively(
        dataSubObject,
        parentDataSubObject,
        childComponent,
        remainingPath,
        selectOccurrence,
      );
    }
  }

  multiInstanceItemAdd(
    dataContext: DataContext,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    messageHandlerService: MessageHandlerService,
  ): void {
    const multiInstanceInfo: MultiInstanceObjectInfo =
      multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
    const templateRepresentation: TemplateComponent = dataContext.templateRepresentation;
    const templateInput: CedarInputTemplate = dataContext.templateInput;

    // The new occurrence is built with the envelope, because the instance is the
    // artifact and that is what an occurrence in one looks like. There used to be
    // a second, envelope-free copy of the whole instance to build it into as
    // well — see `DataContext.instanceExtractData`, now a derived view.
    dataContext.mutate((instance) =>
      this.performItemAdd(
        instance,
        templateRepresentation,
        component,
        multiInstanceObjectService,
        multiInstanceInfo,
        templateInput,
        messageHandlerService,
        DataObjectBuildingMode.INCLUDE_CONTEXT,
      ),
    );
  }

  private performItemAdd(
    instanceObject: InstanceExtractData,
    templateRepresentation: TemplateComponent,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
    multiInstanceInfo: MultiInstanceObjectInfo,
    templateInput: CedarInputTemplate,
    messageHandlerService: MessageHandlerService,
    buildingMode: DataObjectBuildingMode,
  ): void {
    const dataObject = {};
    const cloneComponent = _.cloneDeep(component);
    DataObjectBuilderHandler.setCurrentCountToMinRecursively(cloneComponent, component.path);
    // The `@context` each new occurrence needs travels on the component, so
    // there is no sub-template to find first.
    DataObjectBuilderHandler.buildRecursively(cloneComponent, dataObject, buildingMode);
    const newDataObject = dataObject[component.name][0];
    const currentNodeAny = this.getDataPathNodeRecursively(
      instanceObject,
      templateRepresentation,
      component.path,
      OccurrenceSelectors.fromCursor(multiInstanceObjectService),
    );
    const currentNodeArray = currentNodeAny as [];
    if (currentNodeArray) {
      currentNodeArray.splice(multiInstanceInfo.currentIndex + 1, 0, newDataObject as never);
    } else {
      messageHandlerService.error('missing data in instance:' + component.path);
    }
  }

  multiInstanceItemCopy(
    dataContext: DataContext,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
  ): void {
    const multiInstanceInfo: MultiInstanceObjectInfo =
      multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
    const templateRepresentation: TemplateComponent = dataContext.templateRepresentation;
    dataContext.mutate((instance) =>
      this.performItemCopy(
        instance,
        templateRepresentation,
        component.path,
        multiInstanceObjectService,
        multiInstanceInfo,
      ),
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
      OccurrenceSelectors.fromCursor(multiInstanceObjectService),
    );
    const currentNodeArray = currentNodeAny as [];
    const sourceItem = currentNodeArray[multiInstanceInfo.currentIndex];
    const cloneItem = _.cloneDeep(sourceItem);
    // TODO: Refactor this
    this.cleanUpAtIdsRecursively(cloneItem);
    currentNodeArray.splice(multiInstanceInfo.currentIndex + 1, 0, cloneItem as never);
  }

  multiInstanceItemDelete(
    dataContext: DataContext,
    component: MultiComponent,
    multiInstanceObjectService: MultiInstanceObjectHandler,
  ): void {
    const multiInstanceInfo: MultiInstanceObjectInfo =
      multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
    const templateRepresentation: TemplateComponent = dataContext.templateRepresentation;
    dataContext.mutate((instance) =>
      this.performItemDelete(
        instance,
        templateRepresentation,
        component.path,
        multiInstanceObjectService,
        multiInstanceInfo,
      ),
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
      OccurrenceSelectors.fromCursor(multiInstanceObjectService),
    );
    const currentNodeArray = currentNodeAny as [];
    currentNodeArray.splice(multiInstanceInfo.currentIndex, 1);
  }

  // TODO: refactor this. This is a naive approach.
  // Implement this as a recursive iterator taking into account the component, the multi-info, the template, and the data object
  private cleanUpAtIdsRecursively(item: object) {
    if (Object.hasOwn(item, JsonSchema.atId)) {
      const atIdValue = item[JsonSchema.atId];
      if (atIdValue.startsWith(DataObjectBuilderHandler.getTemplateElementInstanceIRIPrefix())) {
        delete item[JsonSchema.atId];
        DataObjectBuilderHandler.addRandomAtId(item);
      }
    }
    if (item instanceof Object) {
      for (const key in item) {
        const child = item[key];
        if (child instanceof Object) {
          this.cleanUpAtIdsRecursively(child);
        }
      }
    }
  }
}
