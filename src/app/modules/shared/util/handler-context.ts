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
// import { RdfBuilderService } from '../service/rdf-builder.service';

export class HandlerContext {
  readonly dataObjectBuilderService: DataObjectBuilderHandler = null;
  readonly multiInstanceObjectService: MultiInstanceObjectHandler = null;
  readonly dataObjectManipulationService: DataObjectStructureHandler = null;
  readonly dataObjectDataValueHandler: DataObjectDataValueHandler = null;
  readonly dataQualityReportBuilderService: DataQualityReportBuilderHandler;
  readonly dataContext: DataContext = null;
  readonly messageHandlerService: MessageHandlerService = null;
  // readonly rdfService: RdfBuilderService = null;

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
    // this.rdfService = new RdfBuilderService();
  }

  /**
   * Cardinality bounds are a model invariant, enforced here rather than only by
   * the pager disabling its buttons.
   *
   * Value writes stay permissive on purpose — reaching `10` in a field with
   * `minValue: 10` means passing through `1`, so intermediate states must be
   * allowed and the report judges the result. Structural operations have no
   * such transient: there is no legitimate moment at which an element holds
   * more instances than `maxItems` allows.
   *
   * Refusal is a no-op plus a trace, not an exception. The pager already
   * disables the control at the bound, so a call arriving here is a caller bug
   * rather than a user action, and throwing would take the editor down over
   * something recoverable.
   */
  private withinAddBound(component: MultiComponent): boolean {
    const maxItems = component.multiInfo?.maxItems;
    if (maxItems == null) {
      return true;
    }
    const currentCount = this.multiInstanceObjectService.getMultiInstanceInfoForComponent(component)?.currentCount ?? 0;
    if (currentCount < maxItems) {
      return true;
    }
    this.messageHandlerService.trace(
      `refused to add past maxItems (${maxItems}) for ${component.path?.join('/') ?? component.name}`,
    );
    return false;
  }

  private withinDeleteBound(component: MultiComponent): boolean {
    const minItems = component.multiInfo?.minItems;
    const currentCount = this.multiInstanceObjectService.getMultiInstanceInfoForComponent(component)?.currentCount ?? 0;
    if (currentCount === 0) {
      return false;
    }
    if (minItems == null || currentCount > minItems) {
      return true;
    }
    this.messageHandlerService.trace(
      `refused to delete below minItems (${minItems}) for ${component.path?.join('/') ?? component.name}`,
    );
    return false;
  }

  /** @returns whether an instance was added. */
  addMultiInstance(component: MultiComponent): boolean {
    if (!this.withinAddBound(component)) {
      return false;
    }
    this.dataObjectManipulationService.multiInstanceItemAdd(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
      this.messageHandlerService,
    );
    this.multiInstanceObjectService.multiInstanceItemAdd(component);
    this.buildQualityReport();
    return true;
  }

  /** @returns whether an instance was added. */
  copyMultiInstance(component: MultiComponent): boolean {
    const multiInfo = this.multiInstanceObjectService.getMultiInstanceInfoForComponent(component);

    // nothing to copy from, create new
    if (multiInfo.currentIndex < 0) {
      return this.addMultiInstance(component);
    }
    if (!this.withinAddBound(component)) {
      return false;
    }
    this.dataObjectManipulationService.multiInstanceItemCopy(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
    );
    this.multiInstanceObjectService.multiInstanceItemCopy(component);
    this.buildQualityReport();
    return true;
  }

  /** @returns whether an instance was removed. */
  deleteMultiInstance(component: MultiComponent): boolean {
    if (!this.withinDeleteBound(component)) {
      return false;
    }
    this.dataObjectManipulationService.multiInstanceItemDelete(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
    );
    this.multiInstanceObjectService.multiInstanceItemDelete(component);
    this.buildQualityReport();
    return true;
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
    // this.rdfService.toRdf(this.dataContext.instanceFullData);
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
    // this.rdfService.toRdf(this.dataContext.instanceFullData).then((rdf) => {
    //   console.log('RDF', rdf);
    //   console.log('Instance extract data', this.dataContext.instanceExtractData);
    //   this.dataContext.rdf = rdf;
    // });
  }
  enableReadOnlyMode() {
    this.readOnlyMode = true;
  }
  enableEmptyFieldHiding() {
    this.hideEmptyFields = true;
  }
}
