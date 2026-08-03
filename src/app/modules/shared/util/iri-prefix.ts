/**
 * Where CEE mints IRIs for the artifacts it creates.
 *
 * An element occurrence needs an `@id`, and CEE builds one under this prefix.
 * A host page can point it somewhere else through the `iriPrefix` config key.
 *
 * This exists as its own module for a structural reason. The value used to live
 * as a static on `CedarEmbeddableMetadataEditorComponent`, and
 * `DataObjectUtil.getIriPrefix()` reached up into that component to read it —
 * one read, from the domain layer into the top-level Angular component, which
 * dragged the entire component subtree behind it: the HttpClient lookup
 * services, a `package.json` import, and an edge back into `DataObjectUtil`
 * itself. A genuine import cycle, surviving only because webpack tolerates one.
 *
 * It also cost the test harness a stub of the whole editor component, purely to
 * cut that edge — `harness/stubs/editor-component.ts`, now deleted along with
 * its alias.
 *
 * Deliberately importing nothing. That is the entire point: anything may read
 * this, and reading it pulls in nothing else.
 */
export class IriPrefix {
  private static prefix = 'https://repo.metadatacenter.org/';

  /** The prefix CEE mints instance and element IRIs under. */
  static get(): string {
    return IriPrefix.prefix;
  }

  /**
   * Point CEE's minted IRIs somewhere else.
   *
   * Called once, from the editor component, when a host page supplies the
   * `iriPrefix` config key. Mutable global state, kept because that is exactly
   * what it was before and changing the lifetime of a config value is a
   * different question from breaking the cycle.
   */
  static set(value: string): void {
    IriPrefix.prefix = value;
  }
}
