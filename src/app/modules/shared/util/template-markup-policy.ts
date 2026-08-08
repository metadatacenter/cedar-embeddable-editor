import DOMPurify from 'dompurify';

/**
 * What a template author's rich text is allowed to render as.
 *
 * CEE draws a static rich-text field's body as HTML, and that body is composed in
 * the Template Designer's CKEditor. The question this file answers is not "is the
 * markup safe" in the abstract but "what survives sanitising it": CEE renders
 * inside someone else's page, so a template that can run script runs it in the
 * host's origin, while a policy that strips the formatting breaks the one feature
 * the field exists for.
 *
 * The allowlists below are taken from an inventory of the 271 static content
 * blocks in the corpora — the numbered CEDAR corpus, the HuBMAP templates and
 * `cedar-test-artifacts` — rather than from what the toolbar offers. Two things in
 * that inventory decided details that a from-first-principles guess got wrong:
 *
 * - **`data:` URLs are load-bearing.** All twenty in the corpus are
 *   `<img src="data:image/png;base64,…">`, so refusing `data:` outright would blank
 *   every inline image. They are allowed on images, for raster types only — SVG is
 *   excluded because an SVG document can carry script.
 * - **Directive attributes are already present.** Corpus template 009 carries
 *   `ng-click` and `ng-class`, pasted from CEDAR's own UI. They are inert in CEE,
 *   which is Angular, but the Template Designer that embeds CEE is *AngularJS*,
 *   where `ng-click` is executable. Nothing matching `ng-*` or `on*` survives.
 *
 * `style` is the reason Angular's own sanitizer cannot be used here: it has no
 * `style` in its attribute allowlist, and 99 of the corpus's content blocks carry
 * one. Sanitising with it would compile, pass, and silently flatten every colour,
 * font size and margin an author set.
 */

/**
 * Elements a template may use.
 *
 * The corpus uses fourteen of these. The rest are the ones CKEditor's configured
 * toolbar can produce — lists, tables, headings, rules — because a corpus of 271
 * blocks not containing a table is not evidence that no template has one.
 */
const ALLOWED_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'div',
  'em',
  'font',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
];

/**
 * Attributes a template may set.
 *
 * `style` is here deliberately, and is the whole reason this policy exists rather
 * than a call to Angular's sanitizer. The legacy presentational attributes
 * (`color`, `face`, `size`, `border`, `cellpadding`…) are here because CKEditor
 * still emits them for tables and `<font>`, and one appears in the corpus.
 */
const ALLOWED_ATTR = [
  'align',
  'alt',
  'border',
  'cellpadding',
  'cellspacing',
  'class',
  'color',
  'colspan',
  'dir',
  'face',
  'height',
  'href',
  'id',
  'lang',
  'name',
  'rel',
  'rowspan',
  'size',
  'span',
  'src',
  'style',
  'summary',
  'target',
  'title',
  'valign',
  'width',
];

/**
 * Which URLs may appear in `href` and `src`.
 *
 * `https`, `http` and `mailto` are the schemes the corpus uses, plus `tel` as the
 * obvious companion to `mailto`. Relative and fragment URLs are kept — a template
 * linking within the host page is doing nothing unusual. Everything else,
 * `javascript:` first among them, is dropped.
 *
 * Raster `data:` images are handled separately, by `ADD_DATA_URI_TAGS`, so that
 * they are permitted on `<img>` and nowhere else.
 */
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|tel:|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i;

const DATA_IMAGE = /^data:image\/(?:png|jpeg|jpg|gif|webp|bmp);base64,[a-z0-9+/=\s]*$/i;

let hooked = false;

/**
 * Install the two rules DOMPurify's configuration cannot express.
 *
 * Done once, on first use, rather than at module load: the module is imported by
 * code the harness type-checks without a DOM, and DOMPurify's hooks want one.
 */
const installHooks = (): void => {
  if (hooked) {
    return;
  }
  hooked = true;

  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    // `ng-*` is executable in an AngularJS host, and `on*` is executable
    // everywhere. DOMPurify drops unknown attributes anyway; these are named so
    // that adding one to `ALLOWED_ATTR` later cannot let them back in by accident.
    if (/^(?:ng-|data-ng-|x-ng-|on)/i.test(data.attrName)) {
      data.keepAttr = false;
    }
  });

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // A raster data image, or no data URL at all. `ADD_DATA_URI_TAGS` opens
    // `<img src>` to every `data:` type including `image/svg+xml`, which can carry
    // script, so the type is checked here rather than assumed.
    if (node instanceof Element && node.tagName === 'IMG') {
      const src = node.getAttribute('src') ?? '';
      if (src.toLowerCase().startsWith('data:') && !DATA_IMAGE.test(src)) {
        node.removeAttribute('src');
      }
    }
    // A link that opens a new tab gets `rel="noopener noreferrer"`, so a template
    // cannot reach back into the host page through `window.opener`.
    if (node instanceof Element && node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
};

const escapeMarkup = (content: string): string =>
  content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Sanitise a template author's rich text, keeping the formatting they composed.
 *
 * Returns markup, not a trusted value: what the caller does with the result is the
 * caller's decision, and `TrustHtmlPipe` is the only one that makes it.
 *
 * Fails closed where DOMPurify cannot run. It needs a DOM, and without one it does
 * not degrade to passing content through — `sanitize` is simply not a function, so
 * the caller would get "sanitize is not a function" from a rendering pipe and lose
 * the whole form. CEE only ever runs in a browser, so this is a guard against a
 * situation rather than a known one; escaping is the answer that keeps the content
 * visible as text while guaranteeing none of it executes.
 */
export const sanitizeTemplateMarkup = (content: string): string => {
  if (!DOMPurify.isSupported) {
    return escapeMarkup(content);
  }
  installHooks();
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ADD_DATA_URI_TAGS: ['img'],
    // No `<template>`, no `<style>`, and no mXSS through nested markup.
    FORBID_TAGS: ['style', 'template', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['srcset', 'formaction', 'xlink:href'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
    RETURN_TRUSTED_TYPE: false,
  }) as string;
};

/** The policy's own description, for tests and for the README to stay honest against. */
export const TEMPLATE_MARKUP_POLICY = {
  tags: ALLOWED_TAGS,
  attributes: ALLOWED_ATTR,
  dataImages: DATA_IMAGE,
} as const;
