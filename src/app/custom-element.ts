export const CEDAR_CUSTOM_ELEMENT_NAME = 'cedar-embeddable-editor';
export const CEDAR_EMBEDDABLE_FIELD_CUSTOM_ELEMENT_NAME = 'cedar-embeddable-field';

type CustomElementRegistryLike = Pick<CustomElementRegistry, 'define' | 'get'>;

/**
 * Register one of CEE's elements without replacing a definition supplied by an earlier
 * bundle.
 *
 * The name is a parameter because the bundle registers two elements from one
 * bootstrap: the editor, and the `cedar-embeddable-field` element that renders one of
 * its widgets. Registering them together is what keeps a page from taking the editor
 * from one copy of CEE and the field element from another — they describe values in the
 * same model classes, and two versions of those are not one contract.
 */
export function defineCustomElementOnce(
  name: string,
  createElement: () => CustomElementConstructor,
  registry: CustomElementRegistryLike = customElements,
): void {
  if (registry.get(name)) {
    return;
  }

  registry.define(name, createElement());
}
