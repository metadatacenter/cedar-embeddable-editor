import { CedarInputTemplate } from '../models/cedar-input-template.model';
import { TemplateComponent } from '../models/template/template-component.model';
import { MultiInstanceInfo } from '../models/info/multi-instance-info.model';
import { TemplateRepresentationFactory } from '../factory/template-representation.factory';
import { TemplateParser } from '../factory/template-parser';
import { InstanceCardinalityReader } from '../handler/instance-cardinality-reader';
import { TemplateInstance } from 'cedar-model-typescript-library';
import { HandlerContext } from './handler-context';
import { MultiInstanceObjectHandler } from '../handler/multi-instance-object.handler';
import { DataObjectBuilderHandler } from '../handler/data-object-builder.handler';
import { PageBreakPaginatorService } from '../service/page-break-paginator.service';
import { DataQualityReport } from '../models/data-quality-report.model';
import { InstanceNode, InstanceObject } from '../models/instance-node.model';

export class DataContext {
  templateInput: CedarInputTemplate | null = null;
  templateRepresentation: TemplateComponent | null = null;
  /** The instance CEE is editing. A model, not the document it will be written as. */
  instanceFullData: TemplateInstance | null = null;
  multiInstanceData: MultiInstanceInfo | null = null;
  dataQualityReport: DataQualityReport | null = null;
  /** Null until a template is saved, and reset to null when one is replaced. */
  savedTemplateID: string | null = null;

  private derivedExtract: InstanceObject | null = null;

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
  get instanceExtractData(): InstanceObject | null {
    if (this.derivedExtract === null && this.instanceFullData !== null) {
      this.derivedExtract = this.instanceFullData.dataContainer;
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
  mutate(change: (instance: InstanceNode | null) => void): void {
    change(this.instanceFullData?.dataContainer ?? null);
    this.invalidateDerivedViews();
  }

  /** Forget the derived view. Called for any change made outside `mutate`. */
  invalidateDerivedViews(): void {
    this.derivedExtract = null;
  }

  setInputTemplate(
    value: object,
    handlerContext: HandlerContext,
    /*
     * Nullable, because it is created by the editor's `handlerContextObject`
     * setter and a caller can legitimately have a handler context without having
     * gone through that setter. Requiring it here would make accepting a template
     * depend on the paginator existing, which is the wrong way round: the
     * paginator is told about the template, not the other way about.
     */
    pageBreakPaginatorService: PageBreakPaginatorService | null,
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
      handlerContext,
      templateParser,
    );
    pageBreakPaginatorService?.reset(this.templateRepresentation.pageBreakChildren);
    const multiInstanceObjectService: MultiInstanceObjectHandler = handlerContext.multiInstanceObjectService;
    // A host page may have handed us an instance already; otherwise build a
    // skeleton from the template.
    if (this.instanceFullData === null) {
      const dataObjectService: DataObjectBuilderHandler = handlerContext.dataObjectBuilderService;
      this.instanceFullData = dataObjectService.buildNewFullDataObject(this.templateRepresentation);
      this.invalidateDerivedViews();
      this.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        this.templateRepresentation,
        null,
        instanceReader,
      );
    } else {
      this.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        this.templateRepresentation,
        this.instanceFullData.dataContainer,
        instanceReader,
      );
    }
    // The envelope used to be filled in here as well as in the builder, because
    // an injected instance skips the builder and every loaded document was
    // failing validation against its own template without it. A
    // `TemplateInstance` carries those fields wherever it came from, and the
    // writer emits them.
    this.invalidateDerivedViews();

    this.savedTemplateID = null;
    // Built in read-only mode too. The guard used to skip it on the reasoning
    // that nothing can be edited, so validity was uninteresting — but a viewer
    // showing an injected instance is exactly where knowing it is malformed
    // matters. It was also the one path where an instance reached the screen
    // with no validation at any layer, since read-only suppresses the widgets'
    // own errors.
    handlerContext.buildQualityReport();
  }
}
