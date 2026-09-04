import { expect, test } from '@playwright/test';
import { changeDetails, currentMetadata, open, passDebounceWindow, recordChanges } from './support/host';

test.describe('host change notifications', () => {
  test('a canonical loaded instance emits no initialization change', async ({ page }) => {
    await open(page, '01-input-types', undefined, '14-markup-in-a-value');

    expect(await changeDetails(page)).toEqual([]);
  });

  test('initial temporal normalization is reported as a serialized-instance change', async ({ page }) => {
    await open(page, '21-temporal-normalization', undefined, '21-temporal-normalization-instance');

    const details = await changeDetails(page);
    expect(details.length).toBeGreaterThan(0);
    expect(details.every((detail) => detail.operation === 'valueChanged')).toBe(true);
    expect(details.map((detail) => detail.path.at(-1))).toEqual(
      expect.arrayContaining(['_date_year', '_date_month', '_datetime_day', '_time_minute']),
    );
  });

  test('a field edit bubbles a change event and updates currentMetadata', async ({ page }) => {
    await open(page, '01-input-types');
    await recordChanges(page);
    const field = page.locator('input[aria-label="text"]');
    await field.fill('host-visible edit');

    await expect(async () => {
      expect((await changeDetails(page)).length).toBeGreaterThan(0);
    }).toPass();
    const metadata = await currentMetadata(page);
    expect(JSON.stringify(metadata)).toContain('host-visible edit');
    const detail = (await changeDetails(page)).at(-1)!;
    expect(detail).toEqual({
      operation: 'valueChanged',
      path: expect.arrayContaining(['_text']),
      value: 'host-visible edit',
      validity: expect.any(Boolean),
      dataQualityReport: expect.objectContaining({ isValid: expect.any(Boolean) }),
      title: expect.any(String),
      description: expect.any(String),
    });
  });

  test('an edit and its revert both notify the host before blur', async ({ page }) => {
    await open(page, '01-input-types');
    const baseline = JSON.stringify(await currentMetadata(page));
    await recordChanges(page);
    const field = page.locator('input[aria-label="text"]');

    await field.fill('temporary edit');
    await expect.poll(async () => (await changeDetails(page)).length).toBe(1);
    await field.fill('');
    await expect.poll(async () => (await changeDetails(page)).length).toBe(2);

    expect(JSON.stringify(await currentMetadata(page))).toBe(baseline);
  });

  test('Material selection and clear operations publish model changes', async ({ page }) => {
    await open(page, '02-choices');
    await recordChanges(page);
    const widget = page.locator('app-cedar-input-select').filter({
      has: page.locator('mat-select[aria-label="single_list"]'),
    });

    await widget.locator('mat-select').click();
    // Green is the fixture's declared default. Choose a different value so this
    // exercises a model mutation rather than the intentional no-op suppression.
    await page.locator('mat-option').filter({ hasText: 'Red' }).click();
    await expect.poll(async () => (await changeDetails(page)).length).toBe(1);
    await widget.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect.poll(async () => (await changeDetails(page)).length).toBe(2);

    const details = await changeDetails(page);
    expect(details.map((detail) => detail.operation)).toEqual(['valueChanged', 'valueChanged']);
    expect(details[0].path).toContain('_single_list');
    expect(details[1].value).toBeNull();
  });

  test('controlled-term selection publishes the stored IRI and label', async ({ page }) => {
    const id = 'http://purl.obolibrary.org/obo/NCBITaxon_9606';
    const label = 'Homo sapiens';
    await page.route('http://127.0.0.1:9/unused/bioportal/integrated-search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ collection: [{ id, '@id': id, prefLabel: label }] }),
      });
    });
    await open(page, '04-controlled-terms');
    await recordChanges(page);

    const field = page.locator('input[aria-label="organism"]');
    await field.pressSequentially('Homo', { delay: 40 });
    await passDebounceWindow(page);
    await page.locator('mat-option').filter({ hasText: label }).click();

    await expect.poll(async () => (await changeDetails(page)).length).toBe(1);
    const detail = (await changeDetails(page))[0];
    expect(detail).toMatchObject({ operation: 'valueChanged', value: { iri: id, label } });
    expect(detail.path).toContain('_organism');
  });

  test('temporal clear publishes a model change', async ({ page }) => {
    await open(page, '21-temporal-normalization', undefined, '21-temporal-normalization-instance');
    await recordChanges(page);
    const field = page.locator('app-cedar-input-datetime').nth(4);

    await field.getByRole('button', { name: 'Clear', exact: true }).click();

    await expect.poll(async () => (await changeDetails(page)).length).toBe(1);
    const detail = (await changeDetails(page))[0];
    expect(detail).toMatchObject({ operation: 'valueChanged', value: null });
    expect(detail.path).toContain('_time_fraction');
  });

  test('paging does not report an instance change', async ({ page }) => {
    await open(page, '13-paged-choice', undefined, '13-paged-choice-instance');
    await recordChanges(page);
    const chips = page.locator('app-cedar-multi-pager').first().locator('mat-chip-option');
    await expect(chips).toHaveCount(2);
    await chips.nth(1).click();
    expect(await changeDetails(page)).toEqual([]);
  });

  test('read-only native control traffic does not report an instance change', async ({ page }) => {
    // A blank read-only instance intentionally renders specifications instead of empty controls.
    // This fixture carries an email value so there is a real native value control whose incidental
    // DOM event can be exercised.
    await open(page, '01-input-types', 'readonly', '14-markup-in-a-value');
    await recordChanges(page);
    await page.locator('input[aria-label="email"]').dispatchEvent('change');
    expect(await changeDetails(page)).toEqual([]);
  });

  test('multi-instance add, copy and delete report their operation and obey maxItems', async ({ page }) => {
    await open(page, '13-paged-choice', undefined, '13-paged-choice-instance');
    await recordChanges(page);
    const pager = page.locator('app-cedar-multi-pager').first();
    // `button[mat-icon-button]` rather than every button in the pager: an MDC chip
    // renders its own button inside itself, so a bare `button` locator picks up one
    // per occurrence and the action buttons stop being nth(0..2).
    const add = pager.locator('button[mat-icon-button]').nth(0);
    const copy = pager.locator('button[mat-icon-button]').nth(1);
    const remove = pager.locator('button[mat-icon-button]').nth(2);
    const count = async () => ((await currentMetadata(page))._record as unknown[]).length;
    const messages = async () => (await changeDetails(page)).map((detail) => detail.message).filter(Boolean);

    expect(await count()).toBe(2);
    await add.click();
    await expect(async () => expect(await count()).toBe(3)).toPass();
    await expect(async () => expect(await messages()).toContain('multiInstanceAdded')).toPass();

    await copy.click();
    await expect(async () => expect(await count()).toBe(4)).toPass();
    await expect(async () => expect(await messages()).toContain('multiInstanceCopied')).toPass();
    await expect(add, 'add must disable at maxItems').toBeDisabled();
    await expect(copy, 'copy must disable at maxItems').toBeDisabled();

    await remove.click();
    await expect(async () => expect(await count()).toBe(3)).toPass();
    await expect(async () => expect(await messages()).toContain('multiInstanceDeleted')).toPass();
    await expect(add).toBeEnabled();
  });
});
