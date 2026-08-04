import { ElementRef } from '@angular/core';
import { Platform } from '@angular/cdk/platform';
import { CedarOverlayContainer } from './cedar-overlay-container.service';

describe('CedarOverlayContainer', () => {
  it('mounts and removes the overlay container inside the editor shadow root', () => {
    const editor = document.createElement('cedar-embeddable-editor');
    const shadowRoot = editor.attachShadow({ mode: 'open' });
    const service = new CedarOverlayContainer(
      document,
      { isBrowser: true } as Platform,
      new ElementRef<HTMLElement>(editor),
    );

    const container = service.getContainerElement();

    expect(container.parentNode).toBe(shadowRoot);
    expect(container.classList).toContain('cee-overlay-container');
    expect(document.body.contains(container)).toBe(false);

    service.ngOnDestroy();
    expect(shadowRoot.contains(container)).toBe(false);
  });
});
