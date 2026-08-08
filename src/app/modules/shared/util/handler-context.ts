import { MultiComponent } from '../models/component/multi-component.model';
import { DataContext } from './data-context';
import { MultiInstanceObjectHandler } from '../handler/multi-instance-object.handler';
import { OccurrenceSelectors } from '../handler/occurrence-selector';
import { DataObjectBuilderHandler } from '../handler/data-object-builder.handler';
import { FieldComponent } from '../models/component/field-component.model';
import { DataObjectDataValueHandler } from '../handler/data-object-data-value.handler';
import { DataObjectStructureHandler } from '../handler/data-object-structure.handler';
import { MessageHandlerService } from '../service/message-handler.service';
import { DataQualityReportBuilderHandler } from '../handler/data-quality-report-builder.handler';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import { DEFAULT_IRI_PREFIX } from './iri-prefix';
// import { RdfBuilderService } from '../service/rdf-builder.service';

export class HandlerContext {
  // No `= null` initialisers. The constructor assigns every one of these, so the
  // null was a placeholder that never survived construction — and declaring it
  // made each service nullable at all 45 call sites for a state none of them can
  // observe.
  readonly dataObjectBuilderService: DataObjectBuilderHandler;
  readonly multiInstanceObjectService: MultiInstanceObjectHandler;
  readonly dataObjectManipulationService: DataObjectStructureHandler;
  readonly dataObjectDataValueHandler: DataObjectDataValueHandler;
  readonly dataQualityReportBuilderService: DataQualityReportBuilderHandler;
  readonly dataContext: DataContext;
  readonly messageHandlerService: MessageHandlerService;
  // readonly rdfService: RdfBuilderService = null;

  readOnlyMode: boolean = false;
  hideEmptyFields: boolean = false;

  public constructor(
    dataContext: DataContext,
    messageHandlerService: MessageHandlerService,
    iriPrefix: () => string = () => DEFAULT_IRI_PREFIX,
  ) {
    this.dataObjectBuilderService = new DataObjectBuilderHandler(iriPrefix);
    this.multiInstanceObjectService = new MultiInstanceObjectHandler();
    this.dataObjectBuilderService.injectMultiInstanceService(this.multiInstanceObjectService);
    this.dataObjectManipulationService = new DataObjectStructureHandler(this.dataObjectBuilderService);
    this.dataObjectDataValueHandler = new DataObjectDataValueHandler(messageHandlerService);
    this.dataQualityReportBuilderService = new DataQualityReportBuilderHandler();
    this.dataContext = dataContext;
    this.messageHandlerService = messageHandlerService;
    // How many occurrences a multi component has is a fact about the instance,
    // not a number to be maintained beside it. This is what lets
    // `MultiInstanceObjectInfo.currentCount` read the document — see that class.
    this.multiInstanceObjectService.setInstanceResolver((path) => this.getDataObjectNodeByPath(path));
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

  /**
   * The node at this path, in whichever occurrences the user is looking at.
   *
   * Cursor-dependent, and now says so: two calls with a page turn between them
   * return different nodes. That is what the widgets and the pager want — they
   * act on the visible form — but it makes every caller order-dependent on a
   * mutation, so anything that wants a *particular* occurrence should say which
   * with `getDataObjectNodeAt`.
   */
  getDataObjectNodeByPath(path: string[]): InstanceExtractData {
    return this.dataObjectManipulationService.getDataPathNodeRecursively(
      this.dataContext.instanceFullData,
      this.dataContext.templateRepresentation,
      path,
      OccurrenceSelectors.fromCursor(this.multiInstanceObjectService),
    );
  }

  /**
   * The node at this path, in the occurrences named — outermost multi ancestor
   * first.
   *
   * The same walk with the cursor taken out of it. Same arguments, same node,
   * whatever the user has since paged to.
   */
  getDataObjectNodeAt(path: string[], occurrences: ReadonlyArray<number>): InstanceExtractData {
    return this.dataObjectManipulationService.getDataPathNodeRecursively(
      this.dataContext.instanceFullData,
      this.dataContext.templateRepresentation,
      path,
      OccurrenceSelectors.at(occurrences),
    );
  }

  /** The enclosing object at this path, in the occurrences on screen. */
  getParentDataObjectNodeByPath(path: string[]): InstanceExtractData {
    return this.dataObjectManipulationService.getParentDataPathNodeRecursively(
      this.dataContext.instanceFullData,
      null,
      this.dataContext.templateRepresentation,
      path,
      OccurrenceSelectors.fromCursor(this.multiInstanceObjectService),
    );
  }

  /** The enclosing object at this path, in the occurrences named. */
  getParentDataObjectNodeAt(path: string[], occurrences: ReadonlyArray<number>): InstanceExtractData {
    return this.dataObjectManipulationService.getParentDataPathNodeRecursively(
      this.dataContext.instanceFullData,
      null,
      this.dataContext.templateRepresentation,
      path,
      OccurrenceSelectors.at(occurrences),
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
    //   console.log('Instance extract data', this.dataContext.instanceFullData);
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
