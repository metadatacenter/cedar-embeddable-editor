// @vitest-environment jsdom
import { ElementRef } from '@angular/core';
import { CedarAriaDescriber, TOOLTIP_TEXT_IN_PAGE } from './cedar-aria-describer.service';

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
    expect(control.hasAttribute('aria-describedby')).toBe(false);
    expect(shadowRoot.querySelector('.cdk-describedby-message-container')).toBeNull();
  });

  it('does not describe a host with the name it already has', () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Clear');
    shadowRoot.appendChild(button);

    service.describe(button, 'Clear', 'tooltip');

    expect(button.hasAttribute('aria-describedby')).toBe(false);
    expect(shadowRoot.querySelector('.cdk-describedby-message-container')).toBeNull();
    service.removeDescription(button, 'Clear', 'tooltip');
    expect(button.hasAttribute('aria-describedby')).toBe(false);
  });

  it('does not describe a host whose name already contains the message', () => {
    const mark = document.createElement('span');
    mark.setAttribute('aria-label', 'Property IRI: https://example.org/p');
    shadowRoot.appendChild(mark);

    service.describe(mark, 'https://example.org/p', 'tooltip');

    expect(mark.hasAttribute('aria-describedby')).toBe(false);
    expect(shadowRoot.querySelector('.cdk-describedby-message-container')).toBeNull();
  });

  it('does not describe a host whose tooltip text the page already holds', () => {
    const mark = document.createElement('mat-icon');
    mark.setAttribute('aria-label', 'Description');
    mark.setAttribute(TOOLTIP_TEXT_IN_PAGE, '');
    shadowRoot.appendChild(mark);

    service.describe(mark, 'What this field records', 'tooltip');

    expect(mark.hasAttribute('aria-describedby')).toBe(false);
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
