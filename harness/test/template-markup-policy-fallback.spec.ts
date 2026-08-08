/**
 * The rich-text policy fails closed where it cannot sanitize.
 *
 * This runs in the one environment where that condition is real rather than
 * simulated: the harness has no DOM, DOMPurify reports `isSupported === false`,
 * and without the guard its `sanitize` is not a function at all — a rendering pipe
 * would throw rather than degrade.
 *
 * The policy's actual allowlist is asserted where it can run, in
 * `src/app/modules/shared/util/template-markup-policy.spec.ts` under jsdom and in
 * the browser suite's `template rich text`. Only the fallback belongs here, which
 * is also why `harness/vitest.config.ts` excludes the file from the coverage floor:
 * the branch this reaches is the only one the harness can execute.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeTemplateMarkup } from '@cee/util/template-markup-policy';

describe('without a DOM to sanitize with', () => {
  it('escapes rather than passing markup through', () => {
    const out = sanitizeTemplateMarkup('<img src=x onerror="window.x=1">');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('leaves nothing that could execute', () => {
    const out = sanitizeTemplateMarkup('<script>window.x=1</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;script&gt;');
  });
});
