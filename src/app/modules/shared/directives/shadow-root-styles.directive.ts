import { CSP_NONCE, Directive, ElementRef, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CssVarNamespacer } from '@angular/platform-browser';

import { SHADOW_ROOT_CSS } from './shadow-root-css';

/**
 * Inserts CEE's stylesheet into the shadow root of the component it is a host directive of.
 *
 * The editor and the single field render into shadow roots of their own, and both roots take the
 * same stylesheet. Declared as each component's own style, it reached the bundle twice, about
 * 82 kB a copy. Angular keeps a component's styles as a string in that component's definition, and
 * shares a string only between components of one file. The stylesheet is now compiled once, before
 * the Angular build, and inserted here.
 *
 * The stylesheet takes the place Angular gave a component's own styles. Angular appends them to a
 * new shadow root after the styles it shares with every root, and before the styles of any
 * component rendered inside. It creates a component's host directives between those two steps, so
 * a `<style>` element appended here keeps the cascade order unchanged. As Angular does for a
 * component's styles, it carries the page's nonce and the application's custom-property namespace.
 *
 * @stylesheet ./shadow-root.scss
 */
@Directive({ standalone: true })
export class ShadowRootStyles {
  constructor() {
    const root = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.shadowRoot;
    if (!root) throw new Error('ShadowRootStyles is a host directive of a component with ViewEncapsulation.ShadowDom.');
    // An empty stylesheet means a build configuration in `angular.json` lacks the file replacement,
    // and would render every control unstyled.
    if (!SHADOW_ROOT_CSS) throw new Error('CEE was built without its compiled shadow-root stylesheet.');
    const style = inject(DOCUMENT).createElement('style');
    const nonce = inject(CSP_NONCE, { optional: true });
    if (nonce) style.setAttribute('nonce', nonce);
    // The compiled stylesheet marks each custom property's namespace with `%NS%`, as Angular's
    // compiler does, and Angular's renderer replaces it with the namespace's prefix.
    const prefix = inject(CssVarNamespacer).namespace('--').slice('--'.length);
    style.textContent = SHADOW_ROOT_CSS.replace(/%NS%/g, prefix);
    root.appendChild(style);
  }
}
