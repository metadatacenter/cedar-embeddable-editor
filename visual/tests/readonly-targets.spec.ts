import { expect, test } from '@playwright/test';
import { open } from './support/host';
import { WIDTH_INDEPENDENT } from './width-tags';

for (const fixture of ['01-input-types', '04-controlled-terms', '08-authority']) {
  test(`${fixture} read-only link targets keep their compact artwork and accept edge clicks ${WIDTH_INDEPENDENT}`, async ({
    page,
  }) => {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page, fixture, 'readonly', fixture + '-instance');
      if (fixture === '04-controlled-terms') await expect(page.locator('.cee-authority-icon-link')).toBeVisible();
      const links = page.locator('.cee-term-link-action, .cee-authority-icon-link');
      expect(await links.count()).toBeGreaterThan(0);
      for (const link of await links.all()) {
        await link.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        const geometry = await link.evaluate((element) => {
          const target = element.getBoundingClientRect();
          const art = element.querySelector('mat-icon, img')!.getBoundingClientRect();
          return {
            target: target.toJSON(),
            art: art.toJSON(),
            badge: element.classList.contains('cee-authority-icon-link'),
          };
        });
        expect(geometry.target.width).toBeGreaterThanOrEqual(24);
        expect(geometry.target.height).toBeGreaterThanOrEqual(24);
        expect(geometry.art.width).toBe(geometry.badge ? 60 : 16);
        expect(geometry.art.height).toBe(geometry.badge ? 20 : 16);
        expect(geometry.art.top).toBeGreaterThanOrEqual(geometry.target.top);
        expect(geometry.art.bottom).toBeLessThanOrEqual(geometry.target.bottom);
        const overlapsIdentifier = await link.evaluate((element) => {
          const target = element.getBoundingClientRect();
          const iri = element.closest('.cee-term-link')!.querySelector('.cee-term-link-iri')!.getBoundingClientRect();
          return (
            target.left < iri.right && target.right > iri.left && target.top < iri.bottom && target.bottom > iri.top
          );
        });
        expect(overlapsIdentifier, 'expanded target must not cover the identifier link').toBe(false);
        // Prevent navigation only after a real pointer event reaches the anchor's expanded edge.
        await link.evaluate((element) => {
          element.setAttribute('data-edge-clicks', '0');
          element.addEventListener('click', (event) => {
            event.preventDefault();
            element.setAttribute('data-edge-clicks', String(Number(element.getAttribute('data-edge-clicks')) + 1));
          });
        });
        const { x, y, width: w, height: h } = geometry.target;
        for (const [cx, cy] of [
          [x + w / 2, y + 1],
          [x + w / 2, y + h - 1],
          [x + 1, y + h / 2],
          [x + w - 1, y + h / 2],
        ])
          await page.mouse.click(cx, cy);
        await expect(link).toHaveAttribute('data-edge-clicks', '4');
      }
    }
  });
}
