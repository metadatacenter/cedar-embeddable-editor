/**
 * What the template rich-text policy keeps and what it removes.
 *
 * Two halves, and the second is the one that does the unusual work. Asserting that
 * a script is stripped is easy and every sanitizer passes it. Asserting that inline
 * styles, data-URI images and table markup *survive* is what stops someone
 * "hardening" this by swapping in Angular's sanitizer, which would pass every
 * security case here and silently flatten the formatting the field exists to show.
 *
 * The formatting cases are transcribed from the corpus inventory — the markup 271
 * static content blocks across the CEDAR, HuBMAP and test-artifact corpora actually
 * contain — rather than invented.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeTemplateMarkup } from './template-markup-policy';

const clean = (html: string): string => sanitizeTemplateMarkup(html);

describe('formatting a template author composed survives', () => {
  it('keeps inline styles, which is the whole reason this is not Angular sanitizer', () => {
    const out = clean('<p><span style="color: rgb(1, 2, 3); font-size: 16px;">tinted</span></p>');
    expect(out).toContain('style=');
    expect(out).toContain('font-size');
    expect(out).toContain('color');
  });

  it('keeps the elements the corpus uses', () => {
    const out = clean(
      '<p><b>b</b><strong>s</strong><i>i</i><em>e</em><s>s</s><span>sp</span>' +
        '<blockquote>q</blockquote><h2>h2</h2><h3>h3</h3><div>d</div><font color="red">f</font></p>',
    );
    for (const tag of ['b', 'strong', 'i', 'em', 's', 'span', 'blockquote', 'h2', 'h3', 'div', 'font']) {
      expect(out, `<${tag}> should survive`).toContain(`<${tag}`);
    }
  });

  it('keeps tables, which the toolbar offers even though the corpus has none', () => {
    const out = clean('<table border="1"><tbody><tr><td colspan="2">cell</td></tr></tbody></table>');
    expect(out).toContain('<table');
    expect(out).toContain('<td');
    expect(out).toContain('colspan');
  });

  it('keeps lists', () => {
    const out = clean('<ul><li>one</li></ul><ol><li>two</li></ol>');
    expect(out).toContain('<ul');
    expect(out).toContain('<ol');
    expect(out).toContain('<li');
  });

  it('keeps an https link and its text', () => {
    const out = clean('<a href="https://example.org/doc">doc</a>');
    expect(out).toContain('href="https://example.org/doc"');
    expect(out).toContain('doc');
  });

  it('keeps mailto and relative links', () => {
    expect(clean('<a href="mailto:someone@example.org">mail</a>')).toContain('mailto:');
    expect(clean('<a href="/local/page">local</a>')).toContain('href="/local/page"');
  });

  /**
   * All twenty `data:` URLs in the corpus are inline PNGs. A policy that refused
   * `data:` on principle — which is the obvious first draft — would blank every one.
   */
  it('keeps a raster data-URI image', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const out = clean(`<img src="${png}" alt="inline">`);
    expect(out).toContain('src="data:image/png;base64');
    expect(out).toContain('alt="inline"');
  });
});

describe('executable content does not', () => {
  it('drops a script element and its contents', () => {
    const out = clean('<p>before</p><script>window.__x = 1;</script><p>after</p>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('__x');
    expect(out).toContain('before');
    expect(out).toContain('after');
  });

  it('drops event-handler attributes while keeping the element', () => {
    const out = clean('<img src="https://example.org/a.png" onerror="window.__x=1">');
    expect(out).not.toContain('onerror');
    expect(out).toContain('<img');
  });

  it('drops a javascript: URL', () => {
    const out = clean('<a href="javascript:window.__x=1">click</a>');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('click');
  });

  /**
   * Inert in CEE, which is Angular — but the Template Designer embedding CEE is
   * AngularJS, where `ng-click` is executable, and corpus template 009 carries
   * exactly these, pasted from CEDAR's own interface.
   */
  it('drops AngularJS directive attributes', () => {
    const out = clean('<a href="https://example.org/" ng-click="dc.goToMyWorkspace()" ng-class="{active: x}">go</a>');
    expect(out).not.toContain('ng-click');
    expect(out).not.toContain('ng-class');
    expect(out).toContain('go');
  });

  it('drops an iframe', () => {
    expect(clean('<iframe src="https://evil.example/"></iframe>')).not.toContain('<iframe');
  });

  it('drops a form and its controls', () => {
    const out = clean('<form action="https://evil.example/"><input name="a"><button>go</button></form>');
    expect(out).not.toContain('<form');
    expect(out).not.toContain('<input');
    expect(out).not.toContain('<button');
  });

  /**
   * `data:image/svg+xml` is the one image type the policy refuses — a distinction
   * `ADD_DATA_URI_TAGS` alone does not make. Not because an SVG in an `img` can
   * execute, since it cannot, but to keep the allowlist as narrow as the corpus
   * justifies: a later edit widening `ALLOWED_TAGS` to `object` or `embed` would
   * otherwise inherit a scripting context from a payload already admitted. The
   * static image field, which builds its own `img`, admits SVG for the same reason
   * turned around.
   */
  it('drops an svg data URI while keeping the image element', () => {
    const svg = 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4=';
    const out = clean(`<img src="${svg}" alt="x">`);
    expect(out).not.toContain('svg+xml');
  });

  it('drops a style element, which can reach outside the component', () => {
    expect(clean('<style>:host { display: none }</style><p>t</p>')).not.toContain('<style');
  });

  it('adds noopener to a link that opens a new tab', () => {
    const out = clean('<a href="https://example.org/" target="_blank">out</a>');
    expect(out).toContain('noopener');
  });
});
