export const DEFAULT_IRI_PREFIX = 'https://repo.metadatacenter.org/';
export const DEFAULT_BIO_PORTAL_PREFIX = 'https://bioportal.bioontology.org/ontologies/';

/**
 * All host-configurable IRI prefixes for one embedded editor.
 *
 * The wrapper component creates and provides this class at component scope, so
 * every `<cedar-embeddable-editor>` receives a separate instance. The class is
 * deliberately framework-free because the domain builder also consumes it.
 */
export class IriPrefix {
  private iriPrefix = DEFAULT_IRI_PREFIX;
  private bioPortalPrefix = DEFAULT_BIO_PORTAL_PREFIX;

  get(): string {
    return this.iriPrefix;
  }

  set(value: string): void {
    this.iriPrefix = value;
  }

  getBioPortalPrefix(): string {
    return this.bioPortalPrefix;
  }

  setBioPortalPrefix(value: string): void {
    this.bioPortalPrefix = value;
  }
}
