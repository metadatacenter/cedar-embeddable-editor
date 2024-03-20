import { MultiComponent } from '../models/component/multi-component.model';
import { DataContext } from './data-context';
import { MultiInstanceObjectHandler } from '../handler/multi-instance-object.handler';
import { DataObjectBuilderHandler } from '../handler/data-object-builder.handler';
import { FieldComponent } from '../models/component/field-component.model';
import { DataObjectDataValueHandler } from '../handler/data-object-data-value.handler';
import { DataObjectStructureHandler } from '../handler/data-object-structure.handler';
import { MessageHandlerService } from '../service/message-handler.service';
import { DataQualityReportBuilderHandler } from '../handler/data-quality-report-builder.handler';
import { InstanceExtractData } from '../models/instance-extract-data.model';

export class HandlerContext {
  readonly dataObjectBuilderService: DataObjectBuilderHandler = null;
  readonly multiInstanceObjectService: MultiInstanceObjectHandler = null;
  readonly dataObjectManipulationService: DataObjectStructureHandler = null;
  readonly dataObjectDataValueHandler: DataObjectDataValueHandler = null;
  readonly dataQualityReportBuilderService: DataQualityReportBuilderHandler;
  readonly dataContext: DataContext = null;
  readonly messageHandlerService: MessageHandlerService = null;

  readOnlyMode: boolean = false;
  hideEmptyFields: boolean = false;

  public constructor(dataContext: DataContext, messageHandlerService: MessageHandlerService) {
    this.dataObjectBuilderService = new DataObjectBuilderHandler();
    this.multiInstanceObjectService = new MultiInstanceObjectHandler();
    this.dataObjectBuilderService.injectMultiInstanceService(this.multiInstanceObjectService);
    this.dataObjectManipulationService = new DataObjectStructureHandler();
    this.dataObjectDataValueHandler = new DataObjectDataValueHandler(messageHandlerService);
    this.dataQualityReportBuilderService = new DataQualityReportBuilderHandler();
    this.dataContext = dataContext;
    this.messageHandlerService = messageHandlerService;
  }

  addMultiInstance(component: MultiComponent): void {
    this.dataObjectManipulationService.multiInstanceItemAdd(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
      this.messageHandlerService,
    );
    this.multiInstanceObjectService.multiInstanceItemAdd(component);
    this.buildQualityReport();
  }

  copyMultiInstance(component: MultiComponent): void {
    const multiInfo = this.multiInstanceObjectService.getMultiInstanceInfoForComponent(component);

    // nothing to copy from, create new
    if (multiInfo.currentIndex < 0) {
      this.addMultiInstance(component);
    } else {
      this.dataObjectManipulationService.multiInstanceItemCopy(
        this.dataContext,
        component,
        this.multiInstanceObjectService,
      );
      this.multiInstanceObjectService.multiInstanceItemCopy(component);
    }
    this.buildQualityReport();
  }

  deleteMultiInstance(component: MultiComponent): void {
    this.dataObjectManipulationService.multiInstanceItemDelete(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
    );
    this.multiInstanceObjectService.multiInstanceItemDelete(component);
    this.buildQualityReport();
  }

  getDataObjectNodeByPath(path: string[]): InstanceExtractData {
    return this.dataObjectManipulationService.getDataPathNodeRecursively(
      this.dataContext.instanceExtractData,
      this.dataContext.templateRepresentation,
      path,
      this.multiInstanceObjectService,
    );
  }

  getParentDataObjectNodeByPath(path: string[]): InstanceExtractData {
    return this.dataObjectManipulationService.getParentDataPathNodeRecursively(
      this.dataContext.instanceExtractData,
      null,
      this.dataContext.templateRepresentation,
      path,
      this.multiInstanceObjectService,
    );
  }

  setCurrentIndex(component: MultiComponent, idx: number): void {
    this.multiInstanceObjectService.setCurrentIndex(component, idx);
  }

  changeValue(component: FieldComponent, value: string): void {
    this.dataObjectDataValueHandler.changeValue(this.dataContext, component, this.multiInstanceObjectService, value);
    this.buildQualityReport();
  }

  changeListValue(component: FieldComponent, value: string[]): void {
    this.dataObjectDataValueHandler.changeListValue(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
      value,
    );
    this.buildQualityReport();
  }

  changeAttributeValue(component: FieldComponent, key: string, value: string): void {
    this.dataObjectDataValueHandler.changeAttributeValue(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
      key,
      value,
    );
    this.buildQualityReport();
  }

  deleteAttributeValue(component: FieldComponent, key: string): void {
    this.dataObjectDataValueHandler.deleteAttributeValue(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
      key,
    );
    this.buildQualityReport();
  }

  changeControlledValue(component: FieldComponent, atId: string, prefLabel: string): void {
    this.dataObjectDataValueHandler.changeControlledValue(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
      atId,
      prefLabel,
    );
    this.buildQualityReport();
  }

  buildQualityReport() {
    this.dataContext.dataQualityReport = this.dataQualityReportBuilderService.buildReport(this.dataContext, this);
  }
  enableReadOnlyMode() {
    this.readOnlyMode = true;
  }
  enableEmptyFieldHiding() {
    this.hideEmptyFields = true;
  }
}
