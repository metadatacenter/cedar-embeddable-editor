import { CedarInputTemplate } from '../models/cedar-input-template.model';
import { TemplateComponent } from '../models/template/template-component.model';
import { MultiInstanceInfo } from '../models/info/multi-instance-info.model';
import { TemplateRepresentationFactory } from '../factory/template-representation.factory';
import { TemplateParser } from '../factory/template-parser';
import { InstanceCardinalityReader } from '../handler/instance-cardinality-reader';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import { InstanceFullData } from '../models/instance-full-data.model';
import { HandlerContext } from './handler-context';
import { MultiInstanceObjectHandler } from '../handler/multi-instance-object.handler';
import { DataObjectBuilderHandler } from '../handler/data-object-builder.handler';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { PageBreakPaginatorService } from '../service/page-break-paginator.service';
import { DataQualityReport } from '../models/data-quality-report.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { ElementComponent } from '../models/component/element-component.model';

export class DataContext {
  templateInput: CedarInputTemplate = null;
  templateRepresentation: TemplateComponent = null;
  instanceExtractData: InstanceExtractData = null;
  instanceFullData: InstanceFullData = null;
  multiInstanceData: MultiInstanceInfo = null;
  dataQualityReport: DataQualityReport = null;
  savedTemplateID: string;

  public constructor() {}

  /**
   * Apply one mutation to both instance trees.
   *
   * CEE keeps the instance twice: `instanceFullData` is the artifact, envelope
   * and all, and `instanceExtractData` is the same content with the envelope left
   * off at every depth. The widgets read and write the extract; the host page
   * gets the full one. Both have to change together, and every mutation used to
   * do that by making the same call twice with a different first argument —
   * eleven pairs of them across two handlers.
   *
   * Two things were wrong with that. Forgetting the second call was a one-line
   * mistake that nothing would catch, because the trees are only compared when
   * something is emitted. And the *difference* between the trees was implicit:
   * the reason the full copy gets an `@context` and an `@id` and the extract does
   * not is the building mode, which was passed separately, from memory, at each
   * of the eleven sites — and got it wrong at one of them, so a freshly built
   * extract carried element `@id`s that a loaded one never had.
   *
   * Pairing each tree with its own building mode fixes both. One call per
   * mutation, and the mode arrives with the tree it belongs to rather than being
   * remembered alongside it.
   */
  applyToBothTrees(mutate: (tree: InstanceExtractData, buildingMode: DataObjectBuildingMode) => void): void {
    mutate(this.instanceExtractData, DataObjectBuildingMode.EXCLUDE_CONTEXT);
    mutate(this.instanceFullData, DataObjectBuildingMode.INCLUDE_CONTEXT);
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
    //If instance was passed these are extracted from instance. No need to do it from template
    if (this.instanceExtractData === null || this.instanceFullData === null) {
      const dataObjectService: DataObjectBuilderHandler = handlerContext.dataObjectBuilderService;
      this.instanceExtractData = dataObjectService.buildNewExtractDataObject(
        this.templateRepresentation,
        this.templateInput,
      );
      this.instanceFullData = dataObjectService.buildNewFullDataObject(this.templateRepresentation, this.templateInput);
      this.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        this.templateRepresentation,
        null,
        instanceReader,
      );
    } else {
      this.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        this.templateRepresentation,
        handlerContext.dataContext.instanceExtractData,
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
