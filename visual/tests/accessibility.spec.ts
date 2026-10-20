import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open } from './support/host';

/**
 * Automated WCAG checks over every fixture the suite renders.
 *
 * A rule engine decides names, roles, ARIA validity, the contrast it can compute and target
 * sizes. It cannot decide focus order or what a screen reader announces. The tags are the
 * designer's and the term picker's: WCAG 2.0, 2.1 and 2.2 at levels A and AA. Each template is
 * checked empty, filled with each instance written for it, and read only, at both widths. So is
 * the field element on its own under each presentation preset, comfortable density beside the
 * compact default, and an authority search under way and finished.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * WCAG 2.1's Label in Name, criterion 2.5.3: a control's accessible name contains the text it shows,
 * so that speech input reaches it by its visible label. axe-core's rule for it is experimental, and
 * a tag selection leaves experimental rules out, so it runs by name.
 */
const LABEL_IN_NAME = 'label-content-name-mismatch';

const files = readdirSync(fileURLToPath(new URL('../fixtures/', import.meta.url)))
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length));
const templates = files.filter((name) => !name.endsWith('-instance'));
/** An instance belongs to the longest template name it starts with. */
const instancesOf = (template: string) =>
  files.filter(
    (name) =>
      name.endsWith('-instance') &&
      name.startsWith(`${template}-`) &&
      !templates.some((other) => other.length > template.length && name.startsWith(`${other}-`)),
  );

/**
 * Check the whole page once it is still, so contrast is read at full opacity.
 *
 * A stored instance's validation messages appear after the form has loaded, and fade in when they
 * do, later on a slower machine. So the page counts as still only after three passes a tenth of a
 * second apart find nothing running. A shadow tree's animations are listed on its root.
 */
async function expectAccessible(page: Page, state: string): Promise<void> {
  await page.evaluate(async () => {
    let quiet = 0;
    for (let pass = 0; pass < 40 && quiet < 3; pass++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const roots: DocumentOrShadowRoot[] = [document];
      for (const element of document.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
      const running = roots
        .flatMap((root) => root.getAnimations())
        .filter(
          (animation) => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity,
        );
      quiet = running.length ? 0 : quiet + 1;
      await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
    }
  });
  const { violations: tagged, incomplete } = await new AxeBuilder({ page })
    .withTags(WCAG)
    .exclude({ fromShadowDom: ['cedar-embeddable-editor', 'iframe'] })
    .analyze();
  const { violations: named } = await new AxeBuilder({ page })
    .withRules([LABEL_IN_NAME])
    .exclude({ fromShadowDom: ['cedar-embeddable-editor', 'iframe'] })
    .analyze();
  const violations = [...tagged, ...named];
  // A label on an element whose role takes none is ignored by screen readers, decided or not.
  const ignoredLabels = incomplete.filter((result) => result.id === 'aria-prohibited-attr');
  const failures = [...violations, ...ignoredLabels].flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${JSON.stringify(node.target)}`),
  );
  expect.soft(failures, state).toEqual([]);
}

for (const template of templates)
  test(`${template}, empty, filled and read only`, async ({ page }) => {
    await open(page, template);
    await expectAccessible(page, `${template} empty`);
    for (const instance of instancesOf(template)) {
      await open(page, template, undefined, instance);
      await expectAccessible(page, instance);
    }
    await open(page, template, 'readonly');
    await expectAccessible(page, `${template} read only`);
  });

const fixturesDir = new URL('../fixtures/', import.meta.url);
const orderOf = (fixture: string): string[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`${fixture}.json`, fixturesDir)), 'utf8'))._ui.order;

for (const fixture of ['01-input-types', '02-choices', '08-authority', '09-temporal'])
  for (const property of orderOf(fixture))
    test(`the field element for ${fixture} ${property}, editable, read only and in preview`, async ({ page }) => {
      for (const preset of [undefined, 'readonly', 'preview', 'preview-typed']) {
        await open(page, fixture, preset, undefined, undefined, `&host=field&p=${property}`);
        await expectAccessible(page, `${fixture} ${property} ${preset ?? 'editable'}`);
      }
    });

for (const fixture of ['01-input-types', '02-choices', '09-temporal'])
  test(`${fixture} at comfortable density`, async ({ page }) => {
    for (const preset of [undefined, 'readonly']) {
      await open(page, fixture, preset);
      await page.locator('cedar-embeddable-editor').evaluate((editor) => editor.setAttribute('density', 'comfortable'));
      await expectAccessible(page, `${fixture} comfortable ${preset ?? 'editable'}`);
    }
  });

test('an authority search under way, and one that found nothing', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('http://127.0.0.1:9/**', async (route) => {
    await pending;
    await route.fulfill({ json: { found: false, results: {} } });
  });
  await open(page, '08-authority', undefined, undefined, undefined, '&host=field&p=_contributor_orcid');
  const field = page.locator('cedar-embeddable-field');
  await field.locator('input').first().fill('Unmatched example');
  await expect(field.getByText('Searching…', { exact: true })).toBeVisible();
  await expectAccessible(page, 'authority search under way');
  release();
  await expect(field.getByText('No results found', { exact: true })).toBeVisible();
  await expectAccessible(page, 'authority search that found nothing');
});
