/**
 * The contract an embedding page programs against.
 *
 * Everything here is deliberately self-contained: no imports, and no reference to
 * a type declared elsewhere in CEE. That is not tidiness — it is what lets
 * `tsc --emitDeclarationOnly` turn this one file into the `.d.ts` the npm package
 * ships, without dragging in paths that exist only inside this repository.
 *
 * Additive. Nothing here changes what CEE does; it writes down what CEE already
 * accepts and returns, so a host's compiler can check it. The parts of the host
 * contract that need *deciding* rather than describing — whether reassigning
 * `config` replaces or patches, whether `readOnlyMode: false` turns read-only back
 * off, which of the three artifact inputs wins — are not settled here, and are
 * called out at the members they affect.
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
 * Every key is optional, and an omitted key does **not** reliably reset to its
 * default: reassigning `config` patches for most settings and replaces for
 * `outputSerialization`. That inconsistency is real, is not fixed by this type,
 * and is the substance of the host-contract work still outstanding. Until it is
 * settled, treat configuration as set-once.
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
    /** Once enabled, passing `false` does not currently turn it off again. */
    readOnlyMode?: boolean;
    /** Honoured only in read-only mode, and one-way like `readOnlyMode`. */
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
    showInstanceDataCore?: boolean;
    showInstanceDataFull?: boolean;
    showDataQualityReport?: boolean;
    showSampleTemplateLinks?: boolean;
    expandedTemplateRenderingRepresentation?: boolean;
    expandedMultiInstanceInfo?: boolean;
    expandedTemplateSourceData?: boolean;
    expandedInstanceDataCore?: boolean;
    expandedInstanceDataFull?: boolean;
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
/** A template and an instance of it, supplied together. */
export interface CeeTemplateAndInstance {
    template: CeeJsonObject;
    instance: CeeJsonObject;
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
    validationProblems: CeeValidationProblem[];
    /** True when every required field is filled and no constraint is violated. */
    isValid: boolean;
}
/**
 * The callbacks CEE will invoke on the host.
 *
 * Supplied through the `eventHandler` input. Every member is optional.
 */
export interface CeeEventHandler {
    /** A field's value changed. */
    valueChanged?: (path: string[], value: unknown) => void;
    /** CEE has something to say — a template problem, a failed lookup. */
    message?: (message: string) => void;
    /** CEE has finished rendering a template. */
    ready?: () => void;
    [event: string]: unknown;
}
/**
 * The custom element, as a host sees it.
 *
 * Registered as `cedar-embeddable-editor`. The three artifact inputs are
 * alternatives, and which one wins if more than one is set is not currently
 * defined — supply exactly one.
 */
export interface CedarEmbeddableEditorElement extends HTMLElement {
    /** Configuration. See `CeeConfig` for the reassignment caveat. */
    config: CeeConfig;
    /** The template to render, as a parsed CEDAR artifact. */
    templateObject: CeeJsonObject;
    /** An existing instance to load into the form. */
    instanceObject: CeeJsonObject;
    /** Both at once, as `{ template, instance }`. */
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
    /**
     * Fetch configuration from a URL and apply it.
     *
     * Present for hosts that cannot construct the object themselves. Prefer setting
     * `config` directly; CEE should not need to know how to fetch.
     */
    loadConfigFromURL(jsonURL: string, successHandler?: ((config: CeeConfig) => void) | null, errorHandler?: ((request: XMLHttpRequest) => void) | null): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'cedar-embeddable-editor': CedarEmbeddableEditorElement;
    }
}
