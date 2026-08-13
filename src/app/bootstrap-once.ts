export interface CedarEditorBootstrapState {
  cedarEmbeddableEditorBootstrap?: Promise<unknown>;
  /**
   * The version of the bundle that won the bootstrap slot, published for anyone
   * debugging which copy of CEE a page is actually running. Declared here beside
   * the slot it belongs to, so `main.ts` can set it through the same typed window
   * reference rather than casting to `any` twice.
   */
  cedarEmbeddableEditorVersion?: string;
}

/**
 * Claim the page-wide CEE bootstrap slot before Angular starts asynchronously.
 *
 * A custom-element lookup alone is not enough here: two copies of the bundle can
 * both run before the first Angular bootstrap has registered the element.
 */
export function bootstrapCedarEditorOnce(
  state: CedarEditorBootstrapState,
  bootstrap: () => Promise<unknown>,
  reportError: (error: unknown) => void,
): void {
  if (state.cedarEmbeddableEditorBootstrap) {
    return;
  }

  const bootstrapPromise = bootstrap();
  state.cedarEmbeddableEditorBootstrap = bootstrapPromise;
  void bootstrapPromise.catch(reportError);
}
