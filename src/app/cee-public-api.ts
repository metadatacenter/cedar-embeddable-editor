/**
 * The contract an embedding page programs against.
 *
 * Everything here is deliberately self-contained: no imports, and no reference to
 * a type declared elsewhere in CEE. That is not tidiness — it is what lets
 * `tsc --emitDeclarationOnly` turn this one file into the `.d.ts` the npm package
 * ships, without dragging in paths that exist only inside this repository.
 *
 * Configuration and the artifact inputs are set-once: the first assignment stands,
 * and a later one is reported and ignored. A host wanting different configuration or
 * a different artifact creates a new element. That replaces three behaviours which
 * had no answer — a second `config` that patched some keys and replaced others, a
 * read-only mode that could be turned on and not off, and three artifact inputs with
 * no stated precedence. `eventHandler` is deliberately outside it and may be
 * replaced, for the reasons given where it is declared.
 *
 * Types only, with no runtime values, and that is a constraint rather than a
 * style. The shipped bundle is an IIFE that registers a custom element and exports
 * nothing at all, so a `const` declared here would satisfy a host's compiler and
 * then be `undefined` at runtime. Publishing key names as constants has to wait for
 * the package to export anything.
 *
 * `cee-public-api.spec.ts` checks this file against the implementation: every key
 * the editor component reads must appear on `CeeConfig` and vice versa, so the
 * contract cannot drift from the code by being edited in only one place.
 */

/**
 * A configuration key, as a type.
 *
 * Every key of `CeeConfig`, now that the interface is closed. It was
 * `Exclude<keyof CeeConfig, number | symbol>`, which is what an index signature
 * costs: `keyof` on an open interface is `string | number | symbol`, so the type
 * of a key had to be narrowed back down by hand and named nothing more precise
 * than "a string".
 */
export type CeeConfigKey = keyof CeeConfig;

/**
 * The configuration CEE accepts.
 *
 * Every key is optional and an omitted key takes its default, because
 * configuration is applied once and never merged with a previous assignment.
 */
export interface CeeConfig {
  showTemplateDescription?: boolean;

  /**
   * Renders the form without editing controls.
   *
   * The only way in or out of read-only mode. CEE offered the user a toggle of its
   * own, which wrote to the same state the widgets read, so a form embedded as a
   * viewer could be made editable from inside it.
   */
  readOnlyMode?: boolean;

  /**
   * Whether a template author's rich text renders verbatim.
   *
   * Defaults to false, which sanitizes. Set true only if template authors are as
   * trusted as your own application code — see the README's embedding-security
   * section.
   */
  trustTemplateRichText?: boolean;

  /**
   * Offers a menu that saves CEE's views of the artifact as files — the instance
   * as JSON-LD plus standard and compact YAML, the template as JSON Schema plus
   * standard and compact YAML, and the data quality report.
   *
   * Off by default, so an embedded form offers nothing of the sort unless a host
   * asks. Nothing is rendered under the form either way.
   */
  showDownloadMenu?: boolean;

  /**
   * Offers the Expand All and Collapse All buttons above the form.
   *
   * On by default, which is how CEE has always rendered. A host with its own view
   * of the same artifact beside the form — a designer previewing the template it
   * is editing, say — can turn them off so the two are not offered contradictory
   * controls over one thing.
   *
   * The buttons act on the form's own sections and nothing else, so turning them
   * off removes a control rather than fixing the sections open or shut: each
   * still opens and closes on its own header.
   */
  showExpandCollapseAll?: boolean;

  /**
   * Base for controlled-term search. Must end in a slash.
   *
   * Identifies the CEDAR terminology server, and nothing below it: the search
   * path hangs off this and is CEE's own. Unset, controlled fields offer no
   * terms, and CEE says so once.
   *
   * This was `terminologyIntegratedSearchUrl` and took the endpoint whole, so
   * every host spelled out `bioportal/integrated-search` — a route belonging to
   * the terminology server, restated in four deployment configs that would all
   * have to change together if it ever moved.
   */
  terminologyBaseUrl?: string;

  /**
   * Base for every external authority lookup. Must end in a slash.
   *
   * Identifies the CEDAR bridge server, and nothing below it: the fourteen
   * endpoints behind the seven authority fields hang off this and are CEE's own,
   * so a deployment moves all of them by moving this, or none of them. Fourteen
   * keys used to offer the paths one at a time, and every host that set one
   * restated the default.
   *
   * Unset, authority fields offer no terms and resolve no identifiers, and CEE
   * says so once. There was a default — the production bridge — which a host
   * embedding CEE anywhere else reached without asking and without knowing.
   *
   * This was `extAuthBaseUrl` and took the bridge server's `ext-auth/` resource
   * root, the one path segment a host was still left spelling.
   */
  bridgeBaseUrl?: string;

  defaultLanguage?: string;
  fallbackLanguage?: string;
  languageMapPathPrefix?: string;
}

/** A JSON-serialisable value, as it appears in a CEDAR artifact. */
export type CeeJsonValue = string | number | boolean | null | CeeJsonObject | CeeJsonValue[];

export interface CeeJsonObject {
  [key: string]: CeeJsonValue;
}

/**
 * A template and an instance of it, supplied together.
 *
 * The members are `templateObject` and `instanceObject`, the same names the two
 * separate inputs carry. They were published here as `template` and `instance`,
 * which read better and are not what the editor destructures — a host following
 * the declaration got "Template Object is missing." at runtime. Nothing checked
 * the two against each other, so the names could differ without either side
 * looking wrong on its own.
 */
export interface CeeTemplateAndInstance {
  templateObject: CeeJsonObject;
  instanceObject: CeeJsonObject;
}

/**
 * One thing wrong with the instance, as the data quality report sees it.
 *
 * Every member the runtime object carries, unlike `CeeDataQualityReport`, which
 * declares a subset because the report also holds CEE's internal working views. A
 * problem has no internals — it exists to be read by a host — so anything missing
 * here is missing by mistake, which `field` and `inputType` were: documented in the
 * validation guide, present at runtime, and absent from this interface, so a
 * TypeScript host could not read either without a cast.
 */
export interface CeeValidationProblem {
  /** Machine-readable code, e.g. `numberType` or `temporalGranularity`. */
  code: string;
  /** Path to the offending value, outermost first. */
  path: string[];
  /** The field's property name, which is the last path segment. */
  field: string;
  /** The field's declared `_ui.inputType`, or null where it declares none. */
  inputType: string | null;
  /** Human-readable explanation. */
  message: string;
  /** The value that failed, when there is one. */
  value?: unknown;
}

/**
 * What CEE thinks of the instance currently in the form.
 *
 * Read through `dataQualityReport`. These four members are the whole object: it
 * carried three of CEE's internal working views as well, and the interface was a
 * subset of what a host actually received.
 */
export interface CeeDataQualityReport {
  /**
   * How many required fields the template declares.
   *
   * One per declaration, whatever its cardinality — a required field repeated
   * five times counts once, as does a required field inside an element repeated
   * five times.
   */
  requiredFieldValueCount: number;
  /**
   * How many of those the instance fills.
   *
   * A requirement is met when any occurrence carries a value, so this is
   * unaffected by which page the form is showing.
   */
  nonNullRequiredFieldValueCount: number;
  /**
   * Validation problems.
   *
   * Includes one `required` problem for each unsatisfied required field
   * declaration, while the two counters retain their existing aggregate view.
   */
  problems: CeeValidationProblem[];
  /** True when every required field is filled and no constraint is violated. */
  isValid: boolean;
}

/** The model operation that produced a host-visible instance change. */
export type CeeChangeOperation = 'valueChanged' | 'multiInstanceAdded' | 'multiInstanceCopied' | 'multiInstanceDeleted';

/**
 * Detail carried by CEE's composed `change` event.
 *
 * This describes a change to the serialized instance, not traffic from a DOM
 * control. Paging, focus, blur and a write which leaves the instance identical
 * therefore produce no event.
 */
export interface CeeChangeDetail {
  /** What changed. */
  operation: CeeChangeOperation;
  /** Template path of the changed field or multi-instance component. */
  path: string[];
  /** The value supplied to the model operation. */
  value: unknown;
  /** Current validity after the operation. */
  validity: boolean;
  /** Current validation report after the operation. */
  dataQualityReport: CeeDataQualityReport;
  /** Current instance title, where the envelope carries one. */
  title: string | null;
  /** Current instance description, where the envelope carries one. */
  description: string | null;
  /** Backward-compatible name carried by the three multi-instance operations. */
  message?: 'multiInstanceAdded' | 'multiInstanceCopied' | 'multiInstanceDeleted';
}

/**
 * The callbacks CEE will invoke on the host.
 *
 * Supplied through the `eventHandler` input. Every member is optional, and a
 * handler is called only if it has a matching method — so `{ error }` on its own
 * is a valid handler and will not be bothered with traces.
 *
 * `trace`, `error`, `valueChanged`, and `ready` are emitted by
 * `MessageHandlerService`. `message` remains declared for compatibility but is
 * not emitted; structured instance changes use the DOM `change` event above.
 */
export interface CeeEventHandler {
  /** A diagnostic. `value` is the object it concerns, where there is one. */
  trace?: (label: string, value: object | null) => void;
  /** A failure worth surfacing — a template problem, a discarded value. */
  error?: (label: string, value: object | null) => void;
  /** Called after a field mutation actually changes the serialized instance. */
  valueChanged?: (path: string[], value: unknown) => void;
  /**
   * @deprecated Never emitted. Listen for the structured DOM `change` event;
   * this compatibility member will be removed in the next major release.
   */
  message?: (message: string) => void;
  /** Called once, after this element's first successful form render. */
  ready?: () => void;
  [event: string]: unknown;
}

/**
 * The custom element, as a host sees it.
 *
 * Registered as `cedar-embeddable-editor`. Configuration and the artifact inputs
 * each take one assignment; a second is reported through the event handler and
 * ignored, and the first accepted value stands. An unreadable instance is reported
 * and does not spend its assignment, so the host may correct it. An artifact is a
 * template and optionally an instance, so `templateAndInstanceObject` supplies
 * between them what the two separate inputs do and cannot be combined with either.
 *
 * `eventHandler` is the exception, and deliberately: it may be replaced. The
 * sentence above used to be written of every member, which was false for the
 * handler and meaningless for the three read-only getters below.
 */
export interface CedarEmbeddableEditorElement extends HTMLElement {
  /** Typed host mutation event; the inherited overloads still handle every other DOM event. */
  addEventListener(
    type: 'change',
    listener: ((this: CedarEmbeddableEditorElement, event: CustomEvent<CeeChangeDetail>) => unknown) | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;

  /** Typed counterpart to the specialized `change` listener overload. */
  removeEventListener(
    type: 'change',
    listener: ((this: CedarEmbeddableEditorElement, event: CustomEvent<CeeChangeDetail>) => unknown) | null,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;

  /** Configuration. Assign once, before or after the artifact. */
  config: CeeConfig;

  /** The template to render, as a parsed CEDAR artifact. */
  templateObject: CeeJsonObject;

  /**
   * An existing instance to load into the form.
   *
   * Independent of `templateObject`, and either may be assigned first: the form is
   * not built until a template is present, so an instance supplied ahead of one
   * waits rather than loading against nothing.
   */
  instanceObject: CeeJsonObject;

  /** Both at once, as `{ templateObject, instanceObject }`. */
  templateAndInstanceObject: CeeTemplateAndInstance;

  /**
   * Host callbacks, which may be replaced: the last one assigned receives.
   *
   * Set-once protects the inputs that decide what the editor *is*, because the same
   * assignments in a different order used to give a different editor. A handler
   * decides nothing about the form, so nothing here needs an order to reason about,
   * and sealing it would answer a host's second assignment by reporting the refusal
   * *to the handler being replaced*. Replacing a callback slot is also what the DOM
   * does everywhere else.
   *
   * Assign it before the configuration and the artifact if the diagnostics from those
   * matter. A handler hears what CEE emits after it arrives, and CEE has already
   * reported on a configuration by the time a handler assigned later is installed.
   * Replacing one is traced, so a page whose messages stop arriving can see why.
   */
  eventHandler: CeeEventHandler;

  /** The instance as CEDAR JSON. Read-only. */
  readonly currentMetadata: CeeJsonObject;

  /** The instance as CEDAR YAML. Read-only. */
  readonly currentMetadataYaml: string;

  /** What CEE thinks of the instance. Read-only. */
  readonly dataQualityReport: CeeDataQualityReport;
}

declare global {
  interface HTMLElementTagNameMap {
    'cedar-embeddable-editor': CedarEmbeddableEditorElement;
  }
}
