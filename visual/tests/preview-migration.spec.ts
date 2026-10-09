import { expect, test, type Page } from '@playwright/test';
import cedar from 'cedar-model-typescript-library';
import type { CeeJsonObject } from '../../src/app/cee-public-api';
import { currentMetadata, open } from './support/host';

const { BiboStatus, CedarBuilders, CedarWriters, SchemaVersion } = cedar;

function schema(defaultValue: string | null, key = 'answer', multi = false, email = false): CeeJsonObject {
  const field = (email ? CedarBuilders.emailFieldBuilder() : CedarBuilders.textFieldBuilder())
    .withAtId('https://example.org/preview-field')
    .withSchemaName('Answer')
    .withDefaultValue(defaultValue)
    .build();
  const deployment = field
    .createDeploymentBuilder(key)
    .withIri('https://example.org/answer')
    .withMultiInstance(multi)
    .withMinItems(multi ? 0 : null)
    .build();
  const template = CedarBuilders.templateBuilder()
    .withAtId('https://example.org/preview-template')
    .withSchemaName('Preview migration')
    .withSchemaVersion(SchemaVersion.CURRENT)
    .withStatus(BiboStatus.DRAFT)
    .addChild(field, deployment)
    .build();
  return CedarWriters.json().getStrict().getTemplateWriter().getAsJsonNode(template) as unknown as CeeJsonObject;
}

const replace = (page: Page, template: CeeJsonObject) =>
  page.evaluate((value) => {
    document.querySelector('cedar-embeddable-editor')!.templateObject = JSON.parse(value) as CeeJsonObject;
  }, JSON.stringify(template));

test('reader answers survive successive defaults and renaming through the real custom element', async ({ page }) => {
  await open(page, '01-input-types');
  await replace(page, schema('base'));
  const input = page.getByRole('textbox', { name: 'Answer', exact: true });
  await expect(input).toHaveValue('base');
  await input.fill('reader');
  await replace(page, schema('reader', 'renamed'));
  await expect(input).toHaveValue('reader');
  await replace(page, schema('new', 'renamed'));
  await expect(input).toHaveValue('reader');
  await expect.poll(async () => (await currentMetadata(page))['renamed']).toEqual({ '@value': 'reader' });
  await input.fill('');
  await replace(page, schema('final'));
  await expect(input).toHaveValue('');
  await expect.poll(async () => (await currentMetadata(page))['answer']).toEqual({ '@value': null });
});

test('an unfinished email stays visible and keeps its finding after a rename', async ({ page }) => {
  await open(page, '01-input-types');
  await replace(page, schema(null, 'answer', false, true));
  const input = page.getByRole('textbox', { name: 'Answer', exact: true });
  await input.fill('unfinished');
  await replace(page, schema(null, 'renamed', false, true));
  await expect(input).toHaveValue('unfinished');
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .querySelector('cedar-embeddable-editor')!
          .dataQualityReport.problems.filter((problem) => problem.severity === 'error')
          .map((problem) => ({ path: problem.path, code: problem.code })),
      ),
    )
    .toEqual([{ path: ['renamed'], code: 'email' }]);
});

test('deleting a default occurrence stays deleted after a preview edit', async ({ page }) => {
  await open(page, '01-input-types');
  await replace(page, schema('base', 'answer', true));
  await expect(page.getByRole('textbox', { name: 'Answer', exact: true })).toHaveValue('base');
  await page
    .locator('app-cedar-multi-pager')
    .getByRole('button', { name: /delete/i })
    .click();
  await expect.poll(async () => (await currentMetadata(page))['answer']).toEqual([]);
  await replace(page, schema('new', 'answer', true));
  await expect.poll(async () => (await currentMetadata(page))['answer']).toEqual([]);
  await expect(page.getByRole('textbox', { name: 'Answer', exact: true })).toHaveCount(0);
});
