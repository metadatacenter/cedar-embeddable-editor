/**
 * Headless CEE.
 *
 * Reproduces exactly what `CedarEmbeddableMetadataEditorWrapperComponent` does
 * on startup — build a DataContext, build a HandlerContext, feed a template —
 * minus Angular, the DOM, and every widget. That is possible because CEE's
 * domain layer is unusually decoupled from the framework: `HandlerContext` is
 * constructed with `new`, not injected, and the handlers are plain classes.
 *
 * The consequence worth stating: these tests exercise the real production code
 * path for template parsing, instance construction, path resolution, and value
 * writes. Nothing here is a reimplementation or a mock of CEE's logic.
 */
import { DataContext } from '@cee/util/data-context';
import { HandlerContext } from '@cee/util/handler-context';
import { MessageHandlerService } from '@cee/service/message-handler.service';
import { PageBreakPaginatorService } from '@cee/service/page-break-paginator.service';
import type { TemplateParser } from '@cee/factory/template-parser';
import { JsonWalkTemplateParser } from '@cee/factory/json-walk-template-parser';
import type { InstanceCardinalityReader } from '@cee/handler/instance-cardinality-reader';
import { JsonWalkInstanceReader } from '@cee/handler/json-walk-instance-reader';
import { ModelLibraryInstanceReader } from '@cee/handler/model-library-instance-reader';
import type { FieldKind } from './axes';

/**
 * Captures CEE's log output instead of printing it.
 *
 * This is not just noise suppression. `DataObjectStructureHandler` and
 * `DataObjectDataValueHandler` report genuine failures — "missing data in
 * instance", a value written to a slot that does not exist — through
 * `MessageHandlerService.error()` and then carry on silently. Collecting them
 * turns those silent failures into assertable ones. See `expectNoErrors()`.
 */
export class RecordingMessageHandler extends MessageHandlerService {
  readonly traces: string[] = [];
  readonly errors: string[] = [];

  override trace(label: string): void {
    this.traces.push(label);
  }
  override traceGroup(group: string, label: string): void {
    this.traces.push(`${group}: ${label}`);
  }
  override traceObject(label: string, _value: object): void {
    this.traces.push(label);
  }
  override error(label: string): void {
    this.errors.push(label);
  }
  override errorObject(label: string, _value: object): void {
    this.errors.push(label);
  }
}

export interface DriverOptions {
  collapseStaticComponents?: boolean;
  readOnlyMode?: boolean;
  hideEmptyFields?: boolean;
  /** Pre-load an existing instance, as the host page's `instanceObject` would. */
  instance?: object;
  /**
   * Which parser turns the template JSON into the component tree.
   *
   * Unset means whatever `CEE_TEMPLATE_PARSER` selects — see `defaultParser`.
   * The parity suite passes each implementation explicitly and compares the
   * results; everything else lets the environment decide, which is how the
   * whole suite gets run twice.
   */
  templateParser?: TemplateParser;
  /** Which reader derives occurrence counts from an injected instance. */
  instanceReader?: InstanceCardinalityReader;
}

/**
 * The parser every suite uses unless it names one.
 *
 * Defaults to CEE's own default, which is the model library. Set
 * `CEE_TEMPLATE_PARSER=json-walk` and the entire harness runs against the
 * hand-written JSON walk instead. That is the real check on the swap: not a
 * tree diff over a handful of templates, but every assertion in the suite —
 * instance construction, path resolution, value writes, cardinality, the
 * quality report, the corpus snapshots — holding with either parser
 * underneath.
 *
 * An env var rather than a config file because it has to be trivial to run
 * both ways in one command, and because a spec that names a parser explicitly
 * must still win over it.
 */
const PARSER_ENV = process.env.CEE_TEMPLATE_PARSER ?? 'model-library';
export const defaultParser: TemplateParser | undefined =
  PARSER_ENV === 'json-walk' ? new JsonWalkTemplateParser() : undefined;
export const defaultParserName = PARSER_ENV;

/**
 * The instance reader every suite uses unless it names one.
 *
 * Defaults to CEE's own default, which is the model library.
 * `CEE_INSTANCE_READER=json-walk` runs the harness against the hand-written
 * JSON walk instead. Same arrangement as `CEE_TEMPLATE_PARSER`, and
 * the same reason: the only honest check on a swap this deep is every
 * assertion in the suite holding with either side underneath.
 */
const READER_ENV = process.env.CEE_INSTANCE_READER ?? 'model-library';
export const defaultInstanceReader: InstanceCardinalityReader | undefined =
  READER_ENV === 'json-walk' ? new JsonWalkInstanceReader() : new ModelLibraryInstanceReader();
export const defaultInstanceReaderName = READER_ENV;

export class CeeDriver {
  readonly dataContext: DataContext;
  readonly handlerContext: HandlerContext;
  readonly messages: RecordingMessageHandler;
  readonly paginator: PageBreakPaginatorService;

  constructor(template: object, opts: DriverOptions = {}) {
    this.messages = new RecordingMessageHandler();
    this.dataContext = new DataContext();
    this.handlerContext = new HandlerContext(this.dataContext, this.messages);

    if (opts.readOnlyMode) this.handlerContext.enableReadOnlyMode();
    // Mirrors the wrapper: empty-field hiding is only honoured in read-only mode.
    if (opts.hideEmptyFields && this.handlerContext.readOnlyMode) {
      this.handlerContext.enableEmptyFieldHiding();
    }

    // The paginator only touches ActiveComponentRegistryService inside
    // setPageNumberAndGet(), which schedules a setTimeout to push model values
    // back into live widgets. There are no widgets here, so the registry is
    // genuinely unused and null is safe. reset() — the only method the startup
    // path calls — never reads it.
    this.paginator = new PageBreakPaginatorService(null as never, this.handlerContext);

    if (opts.instance) {
      // Same two-clone dance as CedarEmbeddableMetadataEditorComponent
      // .setDataContextWithInstance: full keeps @context, extract drops it.
      this.dataContext.instanceFullData = JSON.parse(JSON.stringify(opts.instance));
      this.dataContext.instanceExtractData = JSON.parse(JSON.stringify(opts.instance));
    }

    this.dataContext.setInputTemplate(
      template,
      this.handlerContext,
      this.paginator,
      opts.collapseStaticComponents ?? false,
      opts.templateParser ?? defaultParser,
      opts.instanceReader ?? defaultInstanceReader,
    );
  }

  /** The component tree CEE would render. */
  get representation(): any {
    return this.dataContext.templateRepresentation;
  }

  /** What the host page receives from `cee.currentMetadata`. */
  get metadata(): any {
    return JSON.parse(JSON.stringify(this.dataContext.instanceFullData));
  }

  get extract(): any {
    return JSON.parse(JSON.stringify(this.dataContext.instanceExtractData));
  }

  get qualityReport(): any {
    return JSON.parse(JSON.stringify(this.dataContext.dataQualityReport));
  }

  /** Locate a component by its template path, e.g. `['_element', '_field']`. */
  find(path: string[]): any {
    let node: any = this.representation;
    for (const segment of path) {
      if (!node?.children) return null;
      node = node.children.find((c: any) => c.name === segment) ?? null;
      if (node === null) return null;
    }
    return node;
  }

  findOrThrow(path: string[]): any {
    const c = this.find(path);
    if (!c) {
      const available = (this.representation?.children ?? []).map((x: any) => x.name);
      throw new Error(`No component at [${path.join(' > ')}]. Root children: [${available.join(', ')}]`);
    }
    return c;
  }

  /**
   * Write a value the way the corresponding widget would.
   *
   * The dispatch mirrors `ActiveComponentRegistryService.updateViewToModel`:
   * controlled terms carry an @id plus a label, attribute-value fields carry a
   * key, and multi-cardinality fields that are *not* paged (checkbox, list)
   * take the whole array at once rather than one value per page.
   */
  setValue(path: string[], kind: FieldKind, value = kind.sample): void {
    if (kind.write === 'none') return;
    const component = this.findOrThrow(path);

    switch (kind.write) {
      case 'controlled':
        this.handlerContext.changeControlledValue(component, `https://example.org/terms/${encodeURIComponent(value)}`, value);
        return;
      case 'attribute':
        // An attribute-value field starts with no occurrences — minItems is 0
        // for this type whatever the template says — so the widget that would
        // let a user type a name does not exist until one is added. Writing
        // without adding puts the value on the parent but leaves the name off
        // the field's own array, a half-written state the UI cannot reach.
        this.addAttributeSlot(component);
        this.handlerContext.changeAttributeValue(component, 'attrKey', value);
        return;
      case 'value':
        if (component.isMulti?.() && !component.isMultiPage?.()) {
          this.handlerContext.changeListValue(component, [value]);
        } else {
          this.handlerContext.changeValue(component, value);
        }
        return;
    }
  }

  /**
   * Give an attribute-value field somewhere to put the next attribute.
   *
   * The pager's "+" does this in the UI. Idempotent in spirit: it only adds
   * when the cursor is not already on a slot, so callers can arm before every
   * write without piling up empty occurrences.
   */
  addAttributeSlot(component: any): void {
    const info = this.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
    if (!info || info.currentIndex < 0) {
      this.handlerContext.addMultiInstance(component);
    }
  }

  /** Fail loudly if CEE logged an error while we were driving it. */
  expectNoErrors(context = ''): void {
    if (this.messages.errors.length > 0) {
      throw new Error(
        `CEE reported ${this.messages.errors.length} error(s)${context ? ` during ${context}` : ''}:\n  ` +
          this.messages.errors.join('\n  '),
      );
    }
  }
}

/** Every `@id` CEE mints at build time, so they can be normalized away. */
const MINTED_ID = /^https:\/\/repo\.metadatacenter\.org\/template-element-instances\//;

/**
 * Replace nondeterministic values with stable placeholders.
 *
 * CEE stamps a fresh RFC4122 GUID onto every element instance it builds
 * (`DataObjectUtil.generateGUID`, which uses `Date.now()` and `Math.random()`).
 * Without this, no two runs produce the same instance and snapshots are
 * worthless. Only CEE-minted IRIs are touched — externally supplied `@id`s are
 * meaningful data and must survive, which is also what
 * `cleanUpAtIdsRecursively` relies on when copying a multi-instance.
 */
export const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '@id' && typeof v === 'string' && MINTED_ID.test(v)) {
        out[k] = '<minted>';
      } else {
        out[k] = normalize(v);
      }
    }
    return out;
  }
  return value;
};
