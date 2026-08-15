export const DEFAULT_IRI_PREFIX = 'https://repo.metadatacenter.org/';

/**
 * The IRI prefix a deployment mints instance identifiers under.
 *
 * The wrapper component creates and provides this class at component scope, so
 * every `<cedar-embeddable-editor>` receives a separate instance. The class is
 * deliberately framework-free because the domain builder also consumes it.
 */
export class IriPrefix {
  private iriPrefix = DEFAULT_IRI_PREFIX;

  get(): string {
    return this.iriPrefix;
  }

  set(value: string): void {
    this.iriPrefix = value;
  }
}
