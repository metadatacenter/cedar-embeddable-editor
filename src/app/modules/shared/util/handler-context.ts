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
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { InputType } from '../models/input-type.model';
import { InstanceDataAttributeValueFieldName } from 'cedar-model-typescript-library';
import { isInstanceArray, isInstanceObject } from '../models/instance-node.model';
import { InstanceValueNode } from './instance-value-node';
import type { CeeChangeOperation } from '../../../cee-public-api';
// import { RdfBuilderService } from '../service/rdf-builder.service';

export interface InstanceMutation {
  readonly operation: CeeChangeOperation;
  readonly path: string[];
  readonly value: unknown;
}

export class HandlerContext {
  private mutationListener: ((mutation: InstanceMutation) => void) | null = null;
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

  /**
   * Whether an instance was handed to the editor, as against a template being previewed on its own.
   *
   * It decides whether a declared default may stand in for an empty control. On a template with no
   * instance behind it, showing the default states what an instance will carry unless someone
   * changes it, and there is no recorded value it could be mistaken for. On an instance it would be
   * a fabrication: a field left blank records `{"@value": null}` for a literal and `{}` for an IRI,
   * both of which assert nothing, and rendering the template's default there tells a reader the
   * instance says something it does not. Worse, defaults are edited: an instance saved when the
   * default was "No" would display "Yes" once someone changed the template, with the instance
   * untouched.
   *
   * Set by the wrapper only after a host-supplied instance has been deserialized. Template parsing
   * and rendering deliberately leave it alone, so a template on its own stays the exact case this
   * flag exists to tell apart.
   */
  instanceSupplied: boolean = false;

  /**
   * Whether a control stands in for a specification rather than holding an answer.
   *
   * Read as a form of the template with nothing filled in: the reader wants to know what an
   * acceptable value is, so a widget states the field instead of showing an empty box, and a
   * declared default is presented as the template's default rather than as a recorded value. The
   * two flags were tested together in three places before this named the question.
   */
  get statesSpecification(): boolean {
    return this.readOnlyMode && !this.instanceSupplied;
  }

  public constructor(dataContext: DataContext, messageHandlerService: MessageHandlerService) {
    this.dataObjectBuilderService = new DataObjectBuilderHandler();
    this.multiInstanceObjectService = new MultiInstanceObjectHandler();
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

  /** Install the wrapper-owned bridge from model mutations to the host contract. */
  setMutationListener(listener: (mutation: InstanceMutation) => void): void {
    this.mutationListener = listener;
  }

  private reportMutation(
    operation: CeeChangeOperation,
    component: FieldComponent | MultiComponent,
    value: unknown,
  ): void {
    this.mutationListener?.({ operation, path: [...component.path], value });
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
    this.reportMutation('multiInstanceAdded', component, {
      count: this.multiInstanceObjectService.getMultiInstanceInfoForComponent(component)?.currentCount ?? 0,
    });
    return true;
  }

  /** @returns whether an instance was added. */
  copyMultiInstance(component: MultiComponent): boolean {
    const multiInfo = this.multiInstanceObjectService.getMultiInstanceInfoForComponent(component);

    // nothing to copy from, create new — and a component the info tree has no node
    // for has nothing to copy either.
    if (multiInfo === null || multiInfo.currentIndex < 0) {
      return this.addMultiInstance(component);
    }
    if (!this.withinAddBound(component)) {
      return false;
    }
    let attributeToCopy: { name: string; value: string | null } | null = null;
    let attributeFieldToCopy: MultiFieldComponent | null = null;
    if (component instanceof MultiFieldComponent && component.basicInfo.inputType === InputType.attributeValue) {
      const slots = this.getDataObjectNodeByPath(component.path);
      const parent = this.getParentDataObjectNodeByPath(component.path);
      const slot = isInstanceArray(slots) ? slots[multiInfo.currentIndex] : null;
      if (slot instanceof InstanceDataAttributeValueFieldName && slot.name !== '' && isInstanceObject(parent)) {
        attributeFieldToCopy = component;
        attributeToCopy = {
          name: slot.name,
          value: InstanceValueNode.literal(parent.values[slot.name]) ?? null,
        };
      }
    }
    this.dataObjectManipulationService.multiInstanceItemCopy(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
    );
    this.multiInstanceObjectService.multiInstanceItemCopy(component);

    if (attributeToCopy !== null && attributeFieldToCopy !== null) {
      let copyNumber = 1;
      let validationError: string | null;
      do {
        const suffix = copyNumber === 1 ? ' copy' : ` copy ${copyNumber}`;
        validationError = this.dataObjectDataValueHandler.changeAttributeValue(
          this.dataContext,
          attributeFieldToCopy,
          this.multiInstanceObjectService,
          `${attributeToCopy.name}${suffix}`,
          attributeToCopy.value,
        );
        copyNumber++;
      } while (validationError !== null && copyNumber <= 1000);

      if (validationError !== null) {
        this.dataObjectDataValueHandler.changeAttributeValue(
          this.dataContext,
          attributeFieldToCopy,
          this.multiInstanceObjectService,
          null,
          attributeToCopy.value,
        );
        this.messageHandlerService.error(`Unable to find a unique name for a copy of "${attributeToCopy.name}".`);
      }
    }
    this.buildQualityReport();
    this.reportMutation('multiInstanceCopied', component, {
      count: this.multiInstanceObjectService.getMultiInstanceInfoForComponent(component)?.currentCount ?? 0,
    });
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
    this.reportMutation('multiInstanceDeleted', component, {
      count: this.multiInstanceObjectService.getMultiInstanceInfoForComponent(component)?.currentCount ?? 0,
    });
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
    const representation = this.dataContext.templateRepresentation;
    if (representation === null) {
      return null;
    }
    return this.dataObjectManipulationService.getDataPathNodeRecursively(
      this.dataContext.instanceFullData?.dataContainer ?? null,
      representation,
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
    const representation = this.dataContext.templateRepresentation;
    if (representation === null) {
      return null;
    }
    return this.dataObjectManipulationService.getDataPathNodeRecursively(
      this.dataContext.instanceFullData?.dataContainer ?? null,
      representation,
      path,
      OccurrenceSelectors.at(occurrences),
    );
  }

  /** The enclosing object at this path, in the occurrences on screen. */
  getParentDataObjectNodeByPath(path: string[]): InstanceExtractData {
    const representation = this.dataContext.templateRepresentation;
    if (representation === null) {
      return null;
    }
    return this.dataObjectManipulationService.getParentDataPathNodeRecursively(
      this.dataContext.instanceFullData?.dataContainer ?? null,
      null,
      representation,
      path,
      OccurrenceSelectors.fromCursor(this.multiInstanceObjectService),
    );
  }

  /** The enclosing object at this path, in the occurrences named. */
  getParentDataObjectNodeAt(path: string[], occurrences: ReadonlyArray<number>): InstanceExtractData {
    const representation = this.dataContext.templateRepresentation;
    if (representation === null) {
      return null;
    }
    return this.dataObjectManipulationService.getParentDataPathNodeRecursively(
      this.dataContext.instanceFullData?.dataContainer ?? null,
      null,
      representation,
      path,
      OccurrenceSelectors.at(occurrences),
    );
  }

  setCurrentIndex(component: MultiComponent, idx: number): void {
    this.multiInstanceObjectService.setCurrentIndex(component, idx);
  }

  /*
   * All four take null, because clearing a field is how null gets here: the
   * widgets call these with null on a clear, and always have. The declarations
   * said `string` and were the half that was wrong.
   */
  changeValue(component: FieldComponent, value: string | null): void {
    this.dataObjectDataValueHandler.changeValue(this.dataContext, component, this.multiInstanceObjectService, value);
    this.buildQualityReport();
    this.reportMutation('valueChanged', component, value);
    // this.rdfService.toRdf(this.dataContext.instanceFullData);
  }

  changeListValue(component: FieldComponent, value: string[] | null): void {
    this.dataObjectDataValueHandler.changeListValue(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
      value,
    );
    this.buildQualityReport();
    this.reportMutation('valueChanged', component, value);
  }

  changeAttributeValue(component: FieldComponent, key: string | null, value: string | null): string | null {
    const validationError = this.dataObjectDataValueHandler.changeAttributeValue(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
      key,
      value,
    );
    this.buildQualityReport();
    this.reportMutation('valueChanged', component, { key, value });
    return validationError;
  }

  deleteAttributeValue(component: FieldComponent, key: string | null): void {
    this.dataObjectDataValueHandler.deleteAttributeValue(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
      key,
    );
    this.buildQualityReport();
    this.reportMutation('valueChanged', component, { key, value: null });
  }

  changeControlledValue(component: FieldComponent, atId: string | null, prefLabel: string | null): void {
    this.dataObjectDataValueHandler.changeControlledValue(
      this.dataContext,
      component,
      this.multiInstanceObjectService,
      atId,
      prefLabel,
    );
    this.buildQualityReport();
    this.reportMutation('valueChanged', component, { iri: atId, label: prefLabel });
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
}
