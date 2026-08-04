import { ElementRef } from '@angular/core';
import { CedarAriaDescriber } from './cedar-aria-describer.service';

describe('CedarAriaDescriber', () => {
  let wrapper: HTMLElement;
  let shadowRoot: ShadowRoot;
  let service: CedarAriaDescriber;

  beforeEach(() => {
    wrapper = document.createElement('cedar-embeddable-editor');
    shadowRoot = wrapper.attachShadow({ mode: 'open' });
    document.body.appendChild(wrapper);
    service = new CedarAriaDescriber(new ElementRef(wrapper));
  });

  afterEach(() => {
    service.ngOnDestroy();
    wrapper.remove();
  });

  it('keeps generated descriptions inside the editor shadow root', () => {
    const control = document.createElement('input');
    shadowRoot.appendChild(control);

    service.describe(control, 'Field help', 'tooltip');

    const descriptionId = control.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(shadowRoot.querySelector(`#${descriptionId}`)?.textContent).toBe('Field help');
    expect(document.body.querySelector(`#${descriptionId}`)).toBeNull();

    service.removeDescription(control, 'Field help', 'tooltip');
    expect(control.hasAttribute('aria-describedby')).toBeFalse();
    expect(shadowRoot.querySelector('.cdk-describedby-message-container')).toBeNull();
  });

  it('preserves aria-describedby ids owned by the host', () => {
    const control = document.createElement('input');
    control.setAttribute('aria-describedby', 'host-description');
    shadowRoot.appendChild(control);

    service.describe(control, 'CEE description');
    service.ngOnDestroy();

    expect(control.getAttribute('aria-describedby')).toBe('host-description');
  });
});
