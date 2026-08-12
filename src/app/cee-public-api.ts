/**
 * The contract an embedding page programs against.
 *
 * Everything here is deliberately self-contained: no imports, and no reference to
 * a type declared elsewhere in CEE. That is not tidiness — it is what lets
 * `tsc --emitDeclarationOnly` turn this one file into the `.d.ts` the npm package
 * ships, without dragging in paths that exist only inside this repository.
 *
 * Every input is set-once: the first assignment stands, and a later one is reported
 * and ignored. A host wanting different configuration or a different artifact
 * creates a new element. That is the whole of the contract's assignment
 * semantics, and it replaces three behaviours that had no answer — a second
 * `config` that patched some keys and replaced others, a read-only mode that could
 * be turned on and not off, and three artifact inputs with no stated precedence.
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

/** How an artifact is serialised on the way in or out. */
export type CeeSerialization = 'json' | 'yaml';

/**
 * The external authorities CEE can look terms up in.
 *
 * Each contributes two configuration keys, `<name>IntegratedExtAuthUrl` and
 * `<name>IntegratedDetailsUrl`, which override the path appended to
 * `extAuthBaseUrl`.
 */
export type CeeAuthority = 'orcid' | 'ror' | 'pfas' | 'pmid' | 'rrid' | 'nihGrant' | 'doi';

/** A configuration key, as a type. */
export type CeeConfigKey = Exclude<keyof CeeConfig, number | symbol>;

/**
 * The configuration CEE accepts.
 *
 * Every key is optional and an omitted key takes its default, because
 * configuration is applied once and never merged with a previous assignment.
 */
export interface CeeConfig {
  showHeader?: boolean;
  showFooter?: boolean;
  showTemplateDescription?: boolean;
  showPreferencesMenu?: boolean;
  showStaticText?: boolean;
  showAllMultiInstanceValues?: boolean;
  collapseStaticComponents?: boolean;
  showSpinnerBeforeInit?: boolean;

  /**
   * Renders the form without editing controls.
   *
   * Host policy rather than a starting position: the preferences menu's read-only
   * toggle is locked while this is set, so a user cannot make an embedded viewer
   * editable.
   */
  readOnlyMode?: boolean;
  /** Honoured only in read-only mode, where an empty field is noise. */
  hideEmptyFields?: boolean;

  /**
   * Whether a template author's rich-text markup renders verbatim.
   *
   * Defaults to false, which sanitizes. Set true only if template authors are as
   * trusted as your own application code — see the README's embedding-security
   * section.
   */
  trustTemplateMarkup?: boolean;

  showTemplateRenderingRepresentation?: boolean;
  showMultiInstanceInfo?: boolean;
  showTemplateSourceData?: boolean;
  showTemplateYaml?: boolean;
  showInstanceDataCore?: boolean;
  showInstanceDataFull?: boolean;
  showInstanceYaml?: boolean;
  showDataQualityReport?: boolean;
  showSampleTemplateLinks?: boolean;
  expandedTemplateRenderingRepresentation?: boolean;
  expandedMultiInstanceInfo?: boolean;
  expandedTemplateSourceData?: boolean;
  expandedTemplateYaml?: boolean;
  expandedInstanceDataCore?: boolean;
  expandedInstanceDataFull?: boolean;
  expandedInstanceYaml?: boolean;
  expandedDataQualityReport?: boolean;
  expandedSampleTemplateLinks?: boolean;

  inputSerialization?: CeeSerialization;
  outputSerialization?: CeeSerialization;

  terminologyIntegratedSearchUrl?: string;
  /** Base for authority lookups. Must end in a slash. */
  extAuthBaseUrl?: string;
  iriPrefix?: string;
  bioPortalPrefix?: string;
  orcidPrefix?: string;
  rorPrefix?: string;

  defaultLanguage?: string;
  fallbackLanguage?: string;
  languageMapPathPrefix?: string;

  sampleTemplateLocationPrefix?: string;
  loadSampleTemplateName?: string;

  /**
   * Per-authority endpoint overrides, `orcidIntegratedExtAuthUrl` and the like.
   *
   * An index signature rather than fourteen declarations, and it is the one place
   * this interface stops catching typos. That is a deliberate trade: closing it
   * would mean a host adding a future authority's key could not compile.
   */
  [authorityEndpoint: string]: unknown;
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

/** One thing wrong with the instance, as the data quality report sees it. */
export interface CeeValidationProblem {
  /** Machine-readable code, e.g. `numberType` or `temporalGranularity`. */
  code: string;
  /** Path to the offending value, outermost first. */
  path: string[];
  /** Human-readable explanation. */
  message: string;
  /** The value that failed, when there is one. */
  value?: unknown;
}

/**
 * What CEE thinks of the instance currently in the form.
 *
 * Read through `dataQualityReport`. Typed here as what a host can rely on; the
 * report object also carries CEE's internal working views, which are not part of
 * this contract and may change.
 */
export interface CeeDataQualityReport {
  /** How many required fields the template declares. */
  requiredFieldValueCount: number;
  /** How many of those the instance actually fills. */
  nonNullRequiredFieldValueCount: number;
  /** Constraint violations. Empty when every present value satisfies its constraints. */
  problems: CeeValidationProblem[];
  /** True when every required field is filled and no constraint is violated. */
  isValid: boolean;
}

/**
 * The callbacks CEE will invoke on the host.
 *
 * Supplied through the `eventHandler` input. Every member is optional, and a
 * handler is called only if it has a matching method — so `{ error }` on its own
 * is a valid handler and will not be bothered with traces.
 *
 * `trace` and `error` are what `MessageHandlerService` emits, and are the only
 * two CEE calls. The three below them were declared here and are invoked
 * nowhere; the index signature is why supplying `trace` or `error` type-checked
 * against an interface that did not mention them, and so why the gap went
 * unnoticed. They are kept, and marked, rather than removed: taking a member off
 * a shipped interface is a decision about the published contract.
 */
export interface CeeEventHandler {
  /** A diagnostic. `value` is the object it concerns, where there is one. */
  trace?: (label: string, value: object | null) => void;
  /** A failure worth surfacing — a template problem, a discarded value. */
  error?: (label: string, value: object | null) => void;
  /** Declared, never called. A field's value changed. */
  valueChanged?: (path: string[], value: unknown) => void;
  /** Declared, never called. CEE has something to say. */
  message?: (message: string) => void;
  /** Declared, never called. CEE has finished rendering a template. */
  ready?: () => void;
  [event: string]: unknown;
}

/**
 * The custom element, as a host sees it.
 *
 * Registered as `cedar-embeddable-editor`. Each member below takes one
 * assignment; a second is reported through the event handler and ignored, and the
 * first value stands. An artifact is a template and optionally an instance, so
 * `templateAndInstanceObject` supplies between them what the two separate inputs
 * do and cannot be combined with either.
 */
export interface CedarEmbeddableEditorElement extends HTMLElement {
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

  /** Host callbacks. */
  eventHandler: CeeEventHandler;

  /** The instance as CEDAR JSON. Read-only. */
  readonly currentMetadata: CeeJsonObject;

  /** The instance as CEDAR YAML. Read-only. */
  readonly currentMetadataYaml: string;

  /** The instance in whichever form `outputSerialization` selected. Read-only. */
  readonly currentMetadataSerialized: CeeJsonObject | string;

  /** What CEE thinks of the instance. Read-only. */
  readonly dataQualityReport: CeeDataQualityReport;
}

declare global {
  interface HTMLElementTagNameMap {
    'cedar-embeddable-editor': CedarEmbeddableEditorElement;
  }
}
