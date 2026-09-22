import { test, expect } from '@playwright/test';
import { open } from './support/host';

for (const fonts of ['bundled', 'host']) {
  for (const readonly of [false, true]) {
    test(`choice colors resist host themes (${fonts}, ${readonly ? 'readonly' : 'editable'})`, async ({ page }) => {
      await open(
        page,
        '02-choices',
        readonly ? 'readonly' : undefined,
        '02-choices-selected-instance',
        undefined,
        fonts === 'host' ? '&fonts=host' : '',
      );
      const editor = page.locator('cedar-embeddable-editor');
      const checkbox = editor
        .locator('mat-checkbox')
        .filter({ has: page.locator('input:checked') })
        .first();
      const radio = editor
        .locator('mat-radio-button')
        .filter({ has: page.locator('input:checked') })
        .first();
      await expect(checkbox).toBeVisible();
      await expect(radio).toBeVisible();
      // OpenView's M2 theme declares component tokens on html. Shadow DOM does
      // not stop custom-property inheritance; M3 fallback colors cannot win it.
      await page.addStyleTag({
        content: `html {
        --mat-sys-primary: magenta;
        --mat-checkbox-selected-icon-color: #861f0f;
        --mat-checkbox-selected-hover-icon-color: #861f0f;
        --mat-checkbox-selected-focus-icon-color: #861f0f;
        --mat-checkbox-selected-pressed-icon-color: #861f0f;
        --mat-checkbox-selected-checkmark-color: black;
        --mat-radio-selected-icon-color: #861f0f;
        --mat-radio-selected-hover-icon-color: #861f0f;
        --mat-radio-selected-focus-icon-color: #861f0f;
        --mat-radio-selected-pressed-icon-color: #861f0f;
      }`,
      });
      await expect(checkbox.locator('.mdc-checkbox__background')).toHaveCSS('background-color', 'rgb(15, 118, 134)');
      await expect(checkbox.locator('.mdc-checkbox__checkmark')).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(radio.locator('.mdc-radio__inner-circle')).toHaveCSS('background-color', 'rgb(15, 118, 134)');
      for (const control of [checkbox, radio]) {
        const kind = control === checkbox ? 'checkbox' : 'radio';
        for (const state of ['focus', 'hover', 'pressed']) {
          await expect(control).toHaveCSS(`--mat-${kind}-selected-${state}-icon-color`, '#0f7686');
        }
      }
    });
  }
}

for (const readonly of [false, true]) {
  for (const kind of ['checkbox', 'radio']) {
    test(`standalone ${kind} resists host theme (${readonly ? 'readonly' : 'editable'})`, async ({ page }) => {
      await open(page, '02-choices', readonly ? 'readonly' : undefined, undefined, undefined, `&host=field&p=_${kind}`);
      await page.evaluate((kind) => {
        document.querySelector('cedar-embeddable-field')!.value =
          kind === 'checkbox' ? { kind: 'literals', values: ['One'] } : { kind: 'literal', value: 'Alpha' };
      }, kind);
      await page.addStyleTag({
        content: `html {
        --mat-checkbox-selected-icon-color: #861f0f;
        --mat-radio-selected-icon-color: #861f0f;
      }`,
      });
      const field = page.locator('cedar-embeddable-field');
      const input = field.locator('input:checked');
      await expect(input).toHaveCount(1);
      const selected = field.locator(
        kind === 'checkbox'
          ? '.mat-mdc-checkbox-checked .mdc-checkbox__background'
          : '.mat-mdc-radio-checked .mdc-radio__inner-circle',
      );
      await expect(selected).toHaveCSS('background-color', 'rgb(15, 118, 134)');
      if (readonly) await expect(input).toHaveAttribute('tabindex', '-1');
    });
  }
}
