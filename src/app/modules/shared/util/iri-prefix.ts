export const DEFAULT_IRI_PREFIX = 'https://repo.metadatacenter.org/';
export const DEFAULT_BIO_PORTAL_PREFIX = 'https://bioportal.bioontology.org/ontologies/';
export const DEFAULT_ORCID_PREFIX = 'https://orcid.org/';
export const DEFAULT_ROR_PREFIX = 'https://ror.org/';

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
  private orcidPrefix = DEFAULT_ORCID_PREFIX;
  private rorPrefix = DEFAULT_ROR_PREFIX;

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

  getOrcidPrefix(): string {
    return this.orcidPrefix;
  }

  setOrcidPrefix(value: string): void {
    this.orcidPrefix = value;
  }

  getRorPrefix(): string {
    return this.rorPrefix;
  }

  setRorPrefix(value: string): void {
    this.rorPrefix = value;
  }
}
