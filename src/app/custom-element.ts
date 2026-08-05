export const CEDAR_CUSTOM_ELEMENT_NAME = 'cedar-embeddable-editor';

type CustomElementRegistryLike = Pick<CustomElementRegistry, 'define' | 'get'>;

/** Register the editor without replacing a definition supplied by an earlier bundle. */
export function defineCustomElementOnce(
  createElement: () => CustomElementConstructor,
  registry: CustomElementRegistryLike = customElements,
): void {
  if (registry.get(CEDAR_CUSTOM_ELEMENT_NAME)) {
    return;
  }

  registry.define(CEDAR_CUSTOM_ELEMENT_NAME, createElement());
}
