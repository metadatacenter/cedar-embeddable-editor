import { CedarInputTemplate } from '../models/cedar-input-template.model';
import { TemplateComponent } from '../models/template/template-component.model';
import { MultiInstanceInfo } from '../models/info/multi-instance-info.model';
import { TemplateRepresentationFactory } from '../factory/template-representation.factory';
import { TemplateParser } from '../factory/template-parser';
import { InstanceCardinalityReader } from '../handler/instance-cardinality-reader';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import { InstanceDeserializer } from './instance-deserializer';
import { InstanceFullData } from '../models/instance-full-data.model';
import { HandlerContext } from './handler-context';
import { MultiInstanceObjectHandler } from '../handler/multi-instance-object.handler';
import { DataObjectBuilderHandler } from '../handler/data-object-builder.handler';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { PageBreakPaginatorService } from '../service/page-break-paginator.service';
import { DataQualityReport } from '../models/data-quality-report.model';
import { InstanceObject } from '../models/instance-node.model';

export class DataContext {
  templateInput: CedarInputTemplate = null;
  templateRepresentation: TemplateComponent = null;
  /** The instance root, which is a JSON-LD document and so always an object. */
  instanceFullData: InstanceObject = null;
  multiInstanceData: MultiInstanceInfo = null;
  dataQualityReport: DataQualityReport = null;
  savedTemplateID: string;

  private derivedExtract: InstanceExtractData = null;

  public constructor() {}

  /**
   * The instance with its envelope left off, at every depth.
   *
   * **Derived, not maintained.** `instanceFullData` is the only tree CEE keeps.
   * This used to be a second one, written to alongside it by every mutation —
   * eleven pairs of identical calls across two handlers — which meant two things
   * that could disagree, and did: `addRandomAtId` ignored the building mode, so a
   * freshly built extract carried element `@id`s a loaded one never had, and
   * nothing noticed because the trees were only ever compared on the way out.
   *
   * It turned out not to be needed. Everything that reads an instance either
   * navigates by *component path* — and no envelope key is a component name, so
   * the envelope is never visited — or goes through the model library's parsed
   * container, which excludes the envelope by construction. The only walk that
   * enumerated raw keys was the one that re-mints element `@id`s when copying an
   * occurrence, and that wants to see them.
   *
   * So the second tree existed to spare consumers a problem none of them had.
   * What is left is a *view*, for the two places that genuinely want to look at
   * the instance without its envelope: the data quality report hands one to the
   * host page, and the source panel displays one.
   *
   * Derived through `InstanceDeserializer`, so the projection is the same library
   * code that produces it at the read boundary rather than a second definition of
   * what "without the envelope" means. Cached because the source panel re-reads
   * it on every change detection; `invalidateDerivedViews` drops the cache, and
   * every mutation goes through `mutate` so nothing has to remember to call it.
   */
  get instanceExtractData(): InstanceExtractData {
    if (this.derivedExtract === null && this.instanceFullData !== null) {
      this.derivedExtract = InstanceDeserializer.read(this.instanceFullData).extract;
    }
    return this.derivedExtract;
  }

  /**
   * Change the instance.
   *
   * One tree, so one call — and the building mode is no longer a parameter,
   * because there is no longer a second shape to build. Every mutation goes
   * through here so the derived view cannot go stale behind one.
   */
  mutate(change: (instance: InstanceFullData) => void): void {
    change(this.instanceFullData);
    this.invalidateDerivedViews();
  }

  /** Forget the derived view. Called for any change made outside `mutate`. */
  invalidateDerivedViews(): void {
    this.derivedExtract = null;
  }

  setInputTemplate(
    value: object,
    handlerContext: HandlerContext,
    pageBreakPaginatorService: PageBreakPaginatorService,
    collapseStaticComponents: boolean,
    // Which parser turns the template's JSON into the component tree. Left
    // unset in production; the parity suite passes both in turn to check they
    // agree. See `factory/template-parser.ts`.
    templateParser?: TemplateParser,
    // Which reader works out occurrence counts from an injected instance.
    // Unset in production; the parity run passes both in turn. See
    // `handler/instance-cardinality-reader.ts`.
    instanceReader?: InstanceCardinalityReader,
  ): void {
    this.templateInput = value as CedarInputTemplate;
    this.templateRepresentation = TemplateRepresentationFactory.create(
      this.templateInput,
      collapseStaticComponents,
      handlerContext,
      templateParser,
    );
    pageBreakPaginatorService.reset(this.templateRepresentation.pageBreakChildren);
    const multiInstanceObjectService: MultiInstanceObjectHandler = handlerContext.multiInstanceObjectService;
    // A host page may have handed us an instance already; otherwise build a
    // skeleton from the template.
    if (this.instanceFullData === null) {
      const dataObjectService: DataObjectBuilderHandler = handlerContext.dataObjectBuilderService;
      this.instanceFullData = dataObjectService.buildNewFullDataObject(this.templateRepresentation, this.templateInput);
      this.invalidateDerivedViews();
      this.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        this.templateRepresentation,
        null,
        instanceReader,
      );
    } else {
      this.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        this.templateRepresentation,
        this.instanceFullData,
        instanceReader,
      );
    }
    // Whether the instance was just built or handed to us by the host page, it
    // has to carry the envelope the template's own JSON Schema requires. An
    // injected instance skips the builder entirely, so doing this only there
    // left every loaded document failing validation against its own template.
    DataObjectBuilderHandler.addEnvelope(
      this.templateRepresentation,
      this.instanceFullData,
      DataObjectBuildingMode.INCLUDE_CONTEXT,
    );
    this.invalidateDerivedViews();

    this.savedTemplateID = null;
    // Built in read-only mode too. The guard used to skip it on the reasoning
    // that nothing can be edited, so validity was uninteresting — but read-only
    // plus hideEmptyFields is the viewer configuration, and a viewer showing an
    // injected instance is exactly where knowing it is malformed matters. It
    // was also the one path where an instance reached the screen with no
    // validation at any layer, since read-only suppresses the widgets' errors.
    handlerContext.buildQualityReport();
  }
}
