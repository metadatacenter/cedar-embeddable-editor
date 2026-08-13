import { CEDAR_CUSTOM_ELEMENT_NAME, defineCustomElementOnce } from './custom-element';

describe('defineCustomElementOnce', () => {
  it('does not create or redefine an element that is already registered', () => {
    let createCount = 0;
    let defineCount = 0;
    const existingElement = class extends HTMLElement {};
    const registry = {
      get: () => existingElement,
      define: () => {
        defineCount++;
      },
    } as Pick<CustomElementRegistry, 'define' | 'get'>;

    defineCustomElementOnce(() => {
      createCount++;
      return class extends HTMLElement {};
    }, registry);

    expect(createCount).toBe(0);
    expect(defineCount).toBe(0);
  });

  it('defines the element when the name is available', () => {
    const cedarElement = class extends HTMLElement {};
    let definedName: string | undefined;
    let definedElement: CustomElementConstructor | undefined;
    const registry = {
      get: () => undefined,
      define: (name: string, element: CustomElementConstructor) => {
        definedName = name;
        definedElement = element;
      },
    } as Pick<CustomElementRegistry, 'define' | 'get'>;

    defineCustomElementOnce(() => cedarElement, registry);

    expect(definedName).toBe(CEDAR_CUSTOM_ELEMENT_NAME);
    expect(definedElement).toBe(cedarElement);
  });
});
