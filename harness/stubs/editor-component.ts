/**
 * Stand-in for `CedarEmbeddableMetadataEditorComponent`.
 *
 * `DataObjectUtil.getIriPrefix()` reads a single static off the top-level
 * Angular component (data-object-util.ts:157). That one read drags the entire
 * component subtree — HttpClient lookup services, a `package.json` import, and
 * a circular edge back into DataObjectUtil itself — into anything that touches
 * the data-object builder.
 *
 * The alias in vitest.config.ts redirects that module here. Everything the
 * domain layer actually reads from it is below.
 *
 * NOTE: if CEE ever moves `iriPrefix` onto a plain constant or a small config
 * holder, this stub and its alias can be deleted outright. That would be a
 * genuine improvement to the app, not just to the tests — the circular import
 * is real and only survives because webpack tolerates it.
 */
export class CedarEmbeddableMetadataEditorComponent {
  /** Mirrors the production default (cedar-embeddable-metadata-editor.component.ts:120). */
  static iriPrefix = 'https://repo.metadatacenter.org/';
}
