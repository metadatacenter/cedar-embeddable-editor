import { expect, test } from '@playwright/test';
import { open } from './support/host';

test.beforeEach(async ({ page }) => {
  await page.route('**/ext-auth/*/verify', (route) =>
    route.fulfill({
      json: {
        status: 'passed',
        code: 'authorityVerified',
        message: 'The authority verified this identifier.',
        iri: route.request().postDataJSON().iri,
      },
    }),
  );
});

const authorities = [
  {
    property: '_contributor_orcid',
    path: 'orcid',
    label: 'ORCID',
    name: 'A researcher',
    iri: 'https://orcid.org/0000-0002-1825-0097',
  },
  {
    property: '_institution_ror',
    path: 'ror',
    label: 'ROR',
    name: 'Stanford University',
    iri: 'https://ror.org/00f54p054',
  },
  {
    property: '_chemical_pfas',
    path: 'comp-tox',
    label: 'PFAS',
    name: 'A chemical',
    iri: 'https://comptox.epa.gov/dashboard/chemical/details/DTXSID3031864',
  },
  {
    property: '_citation_pmid',
    path: 'pmid',
    label: 'PubMed',
    name: 'A paper',
    iri: 'https://pubmed.ncbi.nlm.nih.gov/42834477/',
  },
  {
    property: '_resource_rrid',
    path: 'rrid',
    label: 'RRID',
    name: 'coal metagenome',
    iri: 'https://identifiers.org/RRID:NCBITaxon_1260732',
  },
  {
    property: '_award_nih',
    path: 'nih-grant',
    label: 'NIH Grant',
    name: 'A research grant',
    iri: 'https://reporter.nih.gov/project-details/123456',
  },
  {
    property: '_dataset_doi',
    path: 'doi',
    label: 'DOI',
    name: 'A dataset',
    iri: 'https://doi.org/10.5281/zenodo.1234567890',
  },
];

for (const authority of authorities) {
  test(`${authority.label} opens the selected search result's complete identifier`, async ({ page, context }) => {
    await page.route(`**/ext-auth/${authority.path}/search-by-name?**`, (route) =>
      route.fulfill({ json: { found: true, results: { [authority.iri]: { name: authority.name } } } }),
    );
    // Observe the destination without making CI depend on a third party being reachable.
    await context.route(authority.iri, (route) =>
      route.fulfill({ contentType: 'text/html', body: 'Authority record' }),
    );
    await open(page, '08-authority', undefined, undefined, undefined, `&host=field&p=${authority.property}`);
    const field = page.locator('cedar-embeddable-field');
    const link = field.getByRole('link', { name: `Open the ${authority.label} page`, exact: true });
    await expect(link).toHaveCount(0);
    await field.locator('input').first().fill(authority.name);
    await page.getByRole('option').filter({ hasText: authority.name }).click();
    await expect(link).toHaveAttribute('href', authority.iri);
    await expect(field.locator('input').first()).toHaveValue(`${authority.name} - ${authority.iri}`);
    const opened = context.waitForEvent('page');
    await link.click();
    const destination = await opened;
    await expect(destination).toHaveURL(authority.iri);
    await destination.close();

    // Tab may let the long settled value wrap before activation; Enter must still open it.
    await field.locator('input').first().focus();
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    const keyboardOpened = context.waitForEvent('page');
    await page.keyboard.press('Enter');
    const keyboardDestination = await keyboardOpened;
    await expect(keyboardDestination).toHaveURL(authority.iri);
    await keyboardDestination.close();
  });
}

for (const identifier of [
  'RRID:NCBITaxon_1260732',
  'AB_10013382',
  'https://scicrunch.org/resolver/RRID:Addgene_114536',
]) {
  test(`RRID resolves the prefixed identifier ${identifier}`, async ({ page }) => {
    const lookups: string[] = [];
    const iri =
      'https://identifiers.org/RRID:' +
      identifier
        .split('/')
        .at(-1)!
        .replace(/^RRID:/, '');
    await page.route('**/ext-auth/rrid/**', (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      lookups.push(decodeURIComponent(new URL(route.request().url()).pathname.split('/ext-auth/rrid/')[1]));
      return route.fulfill({ json: { found: true, id: iri, name: 'A resource' } });
    });
    await open(page, '08-authority', undefined, undefined, undefined, '&host=field&p=_resource_rrid');
    await page.locator('cedar-embeddable-field input').first().fill(identifier);
    await page.getByRole('option').filter({ hasText: 'A resource' }).click();
    expect(lookups).toEqual([identifier]);
    await expect(page.getByRole('link', { name: 'Open the RRID page', exact: true })).toHaveAttribute('href', iri);
  });
}
