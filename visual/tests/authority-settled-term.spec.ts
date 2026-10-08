/**
 * A selected external-authority term while nobody is editing its box.
 *
 * The box holds "Label - https://iri", and an `input` shows one line of it, cut wherever the box
 * ends. With a long label the identifier was what went out of view: a PubMed title did it at 1280px,
 * and every authority did it at 480px. Until the user enters the box it now shows the term as
 * read-only does, and the input over it still holds the text, so entering the box edits as before.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { open } from './support/host';

const values: Record<string, [label: string, iri: string]> = {
  _contributor_orcid: ['Josefina Maria Fernández-Castellanos de la Torre', 'https://orcid.org/0000-0002-1825-0097'],
  _institution_ror: [
    'Stanford University School of Medicine, Department of Biomedical Data Science',
    'https://ror.org/00f54p054',
  ],
  _chemical_pfas: [
    'Perfluorooctanesulfonic acid (heptadecafluorooctane-1-sulfonic acid)',
    'https://comptox.epa.gov/dashboard/chemical/details/DTXSID3031864',
  ],
  _citation_pmid: [
    'Ma-khwaen essential oil vapour suppresses potato sprouting under tropical ambient storage via GA(3)-ABA ' +
      'modulation, oxidative stress and carbohydrate metabolism.',
    'https://pubmed.ncbi.nlm.nih.gov/42834477/',
  ],
  _resource_rrid: [
    'Glial Fibrillary Acidic Protein (GFAP) antibody, rabbit polyclonal, Dako Z0334',
    'https://scicrunch.org/resolver/RRID:AB_10013382',
  ],
  _award_nih: [
    'Center for Expanded Data Annotation and Retrieval: metadata authoring for biomedical research',
    'https://reporter.nih.gov/project-details/U54AI117925',
  ],
  _dataset_doi: [
    'Single-cell transcriptomic atlas of the human retina across development and disease',
    'https://doi.org/10.5281/zenodo.1234567890',
  ],
};

/** The authority fixture's instance, every field holding one of the long terms above. */
async function openWithLongTerms(page: Page): Promise<void> {
  const instance = JSON.parse(readFileSync(new URL('../fixtures/08-authority-instance.json', import.meta.url), 'utf8'));
  for (const [property, [label, iri]] of Object.entries(values))
    instance[property] = { '@id': iri, 'rdfs:label': label };
  await page.route('**/fixtures/08-authority-instance.json', (route) => route.fulfill({ json: instance }));
  await open(page, '08-authority', undefined, '08-authority-instance');
}

const box = (page: Page, property: string) =>
  page.locator('mat-form-field').filter({ has: page.locator(`input[aria-label="${property.slice(1)}"]`) });

test('every authority shows its whole identifier while its box is not being edited', async ({ page }) => {
  await openWithLongTerms(page);
  for (const [property, [label, iri]] of Object.entries(values)) {
    const field = box(page, property);
    const term = field.locator('.cee-settled-term');
    await expect(term, property).toBeVisible();
    // The input still holds the whole text, for assistive technology and for the edit a click starts.
    await expect(field.locator('input')).toHaveValue(`${label} - ${iri}`);
    const shown = await term.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const identifier = element.querySelector('.cee-settled-term-iri')!;
      const at = identifier.getBoundingClientRect();
      const name = element.querySelector('.cee-settled-term-label')!;
      return {
        identifier: identifier.textContent,
        inside: at.left >= bounds.left - 0.5 && at.right <= bounds.right + 0.5,
        clipped: identifier.scrollWidth > identifier.clientWidth + 1,
        ellipsized: name.scrollWidth > name.clientWidth + 1,
        lines: Math.round(bounds.height / parseFloat(getComputedStyle(element).lineHeight)),
      };
    });
    expect(shown, property).toMatchObject({ identifier: iri, inside: true, clipped: false });
    // A PubMed title yields to its identifier on one line; any other term wraps rather than shortening.
    if (property === '_citation_pmid') expect(shown, property).toMatchObject({ ellipsized: true, lines: 1 });
    else expect(shown.ellipsized, property).toBe(false);
  }
});

test('entering the box edits the whole text, and leaving it shows the term again', async ({ page }) => {
  await openWithLongTerms(page);
  const [label, iri] = values._citation_pmid;
  const field = box(page, '_citation_pmid');
  const input = field.locator('input');
  await field.click();
  await expect(input).toBeFocused();
  await expect(field.locator('.cee-settled-term')).toHaveCount(0);
  await expect(input).toHaveCSS('opacity', '1');
  await page.keyboard.press('End');
  expect(await input.evaluate((element: HTMLInputElement) => element.selectionStart)).toBe(`${label} - ${iri}`.length);
  await input.blur();
  await expect(field.locator('.cee-settled-term')).toBeVisible();
  await expect(input).toHaveValue(`${label} - ${iri}`);
});

test('Tab reaches the box under the term, as it reached the input before', async ({ page }) => {
  await openWithLongTerms(page);
  const before = box(page, '_chemical_pfas');
  const field = box(page, '_citation_pmid');
  await before.locator('input').focus();
  await page.keyboard.press('Tab');
  // The PFAS box's own open and clear controls come first.
  const focused = () =>
    field
      .locator('input')
      .evaluate((element) => element === (element.getRootNode() as ShadowRoot | Document).activeElement);
  for (let presses = 0; presses < 5 && !(await focused()); presses++) await page.keyboard.press('Tab');
  expect(await focused()).toBe(true);
  await expect(field.locator('.cee-settled-term')).toHaveCount(0);
  await expect(field.locator('input')).toHaveCSS('opacity', '1');
});
