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
import { InstanceDeserializer } from '@cee/util/instance-deserializer';
import type { InstanceObject } from '@cee/models/instance-node.model';
import { ActiveComponentRegistryService } from '@cee/service/active-component-registry.service';
import { HandlerContext } from '@cee/util/handler-context';
import { MessageHandlerService } from '@cee/service/message-handler.service';
import { PageBreakPaginatorService } from '@cee/service/page-break-paginator.service';
import type { TemplateParser } from '@cee/factory/template-parser';
import type { InstanceCardinalityReader } from '@cee/handler/instance-cardinality-reader';
import type { FieldKind } from './axes';
import { present } from './nodes';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { CedarTemplate } from '@cee/models/template/cedar-template.model';
import type { Template } from 'cedar-model-typescript-library';
import { JsonSchema } from 'cedar-model-typescript-library';

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
  instance?: InstanceObject;
  /**
   * Which parser turns the template JSON into the component tree.
   *
   * Unset means CEE's own.
   */
  templateParser?: TemplateParser;
  /** Which reader derives occurrence counts from an injected instance. */
  instanceReader?: InstanceCardinalityReader;
}

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
      // Exactly what CedarEmbeddableMetadataEditorComponent
      // .setDataContextWithInstance does: read once through the model library
      // into the one tree CEE keeps.
      const { full } = InstanceDeserializer.read(opts.instance, (m) => this.messages.error(m));
      this.dataContext.instanceFullData = full;
      this.dataContext.invalidateDerivedViews();
    }

    this.dataContext.setInputTemplate(
      template,
      this.handlerContext,
      this.paginator,
      opts.collapseStaticComponents ?? false,
      opts.templateParser,
      opts.instanceReader,
    );
  }

  /** The component tree CEE would render. */
  get representation(): any {
    return this.dataContext.templateRepresentation;
  }

  /**
   * The instance CEE is editing, asserted present.
   *
   * `DataContext.instanceFullData` is `InstanceObject | null` — null until a
   * template or an instance has been set. Every spec here has set one before it
   * looks, so this states that once instead of at each of the forty-odd reads,
   * and fails with a sentence rather than a null dereference if it is ever
   * wrong. The tree itself, not a copy: writing through it edits what CEE holds,
   * which is what the malformed-node specs are for.
   */
  get fullData(): InstanceObject {
    return present(this.dataContext.instanceFullData, 'instanceFullData');
  }

  /**
   * The live extract view, asserted present.
   *
   * Derived from `fullData` and recomputed after every mutation — the same
   * object the source panel reads. `extract` below is a deep copy of it, for
   * specs that want a value frozen at a moment rather than a view that moves.
   */
  get extractData(): InstanceObject {
    return present(this.dataContext.instanceExtractData, 'instanceExtractData');
  }

  /**
   * A copy of the tree CEE is editing.
   *
   * Not what a host receives — that is `emitted`, and the difference is the
   * point. This is CEE's working copy, taken as JSON so a spec can hold a value
   * from one moment against another, and it is also what a spec feeds back in to
   * load an instance. A claim about *what leaves CEE* does not belong here.
   */
  get metadata(): any {
    return JSON.parse(JSON.stringify(this.dataContext.instanceFullData));
  }

  /**
   * What the host page actually receives from `cee.currentMetadata`.
   *
   * The working tree read into the model, completed against its template and
   * written back out by the library — the same path the wrapper's getter takes.
   * A spec asserting what a saved instance looks like should use this: it is the
   * document, and it does not move when CEE's internal shape does.
   */
  get emitted(): any {
    return InstanceSerializer.toJson(this.dataContext.instanceFullData, this.parsedTemplate());
  }

  /** The template as the library parsed it, or null if none has been set. */
  private parsedTemplate(): Template | null {
    const representation = this.dataContext.templateRepresentation;
    return representation instanceof CedarTemplate ? representation.parsed : null;
  }

  /**
   * The instance without its envelope, as the quality report and the source
   * panel see it.
   *
   * A derived view of `instanceFullData`, not a second tree — see
   * `DataContext.instanceExtractData`. Still the natural thing for a test to
   * assert against, because it is the instance's content with the bookkeeping
   * left out.
   */
  get extract(): any {
    return JSON.parse(JSON.stringify(this.dataContext.instanceExtractData));
  }

  get qualityReport(): any {
    return JSON.parse(JSON.stringify(this.dataContext.dataQualityReport));
  }

  /**
   * Run the empty-field visibility pass, as `hideEmptyFields` does on screen.
   *
   * `ActiveComponentRegistryService.setVisibility` is what decides which
   * components a read-only viewer draws. It needs no registered widgets — it
   * reads the instance and writes `hidden` on the components — so the harness
   * can ask for it directly.
   */
  registryForVisibility(): void {
    new ActiveComponentRegistryService().setVisibility(this.representation, this.handlerContext);
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
        this.handlerContext.changeControlledValue(
          component,
          `https://example.org/terms/${encodeURIComponent(value)}`,
          value,
        );
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
      if (k === JsonSchema.atId && typeof v === 'string' && MINTED_ID.test(v)) {
        out[k] = '<minted>';
      } else {
        out[k] = normalize(v);
      }
    }
    return out;
  }
  return value;
};
