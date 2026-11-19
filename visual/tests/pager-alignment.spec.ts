import { expect, test } from '@playwright/test';
import { open } from './support/host';

for (const label of ['PFAS compound', 'Chemical compound identified in the collected environmental sample'])
  for (const count of [0, 1, 2, 5, 6, 12])
    for (const width of [1280, 768, 375])
      test(`${count} repeated authority values (${label}) keep their header controls aligned at ${width}`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.route('**/fixtures/24-multi-authority-values.json', async (route) => {
          const response = await route.fetch();
          const template = await response.json();
          template._ui.propertyLabels._author = label;
          template._ui.propertyDescriptions._author = '';
          template.properties._author.items._ui.inputType = 'ext-pfas';
          template.properties._author.items['schema:description'] = '';
          await route.fulfill({ response, json: template });
        });
        await page.route('**/fixtures/24-multi-authority-values-instance.json', async (route) => {
          const response = await route.fetch();
          const instance = await response.json();
          instance._author = Array.from({ length: count }, (_, i) => ({
            '@id': `https://comptox.epa.gov/dashboard/chemical/details/DTXSID${i + 3031864}`,
            'rdfs:label': `Hexafluoropropylene oxide dimer acid ${i + 1}`,
          }));
          await route.fulfill({ response, json: instance });
        });
        await open(
          page,
          '24-multi-authority-values',
          undefined,
          '24-multi-authority-values-instance',
          undefined,
          '&f=wrapFieldNames',
        );
        const field = page
          .locator('.non-iterable-component')
          .filter({ has: page.locator('app-cedar-multi-pager') })
          .first();
        await expect(field.locator('app-cedar-component-header')).toContainText(label);
        await expect(field.locator('mat-paginator')).toHaveCount(count > 5 ? 1 : 0);
        const geometry = await field.evaluate((element) => {
          const rect = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
          const header = rect('app-cedar-component-header .flex-container');
          const row = rect('app-cedar-multi-pager > div');
          const boxes = [
            ...element.querySelectorAll('mat-chip-option, .pager-actions button, mat-paginator button'),
          ].map((control) => control.getBoundingClientRect());
          return {
            headerCenter: header.top + header.height / 2,
            headerBottom: header.bottom,
            rowTop: row.top,
            centers: boxes.map((box) => box.top + box.height / 2),
            overflow: document.documentElement.scrollWidth - innerWidth,
            labelBoxes: [...element.querySelectorAll('.title-label, .required-slot, .multi-instance-range')].flatMap(
              (label) => {
                const range = document.createRange();
                range.selectNodeContents(label);
                return [...range.getClientRects()].map((box) => box.toJSON());
              },
            ),
            controlBoxes: boxes.map((box) => box.toJSON()),
          };
        });
        if (count === 12) await field.screenshot({ path: info.outputPath(`paged-header-${width}.png`) });
        expect(geometry.overflow, JSON.stringify(geometry)).toBeLessThanOrEqual(1);
        if (width > 620 && label === 'PFAS compound') {
          const centers = [geometry.headerCenter, ...geometry.centers];
          expect(Math.max(...centers) - Math.min(...centers), JSON.stringify(geometry)).toBeLessThanOrEqual(2);
        } else if (width <= 620) {
          expect(geometry.rowTop).toBeGreaterThanOrEqual(geometry.headerBottom);
        }
        for (const box of geometry.controlBoxes) {
          for (const name of geometry.labelBoxes)
            expect(
              box.right <= name.left || box.left >= name.right || box.bottom <= name.top || box.top >= name.bottom,
              JSON.stringify(geometry),
            ).toBe(true);
        }
      });
