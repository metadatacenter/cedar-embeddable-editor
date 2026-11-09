import type { Locator, Page } from '@playwright/test';

/**
 * A field's box, found by its name, which is the field's label.
 *
 * The box takes that name through `aria-labelledby`, from a hidden element marked with the language
 * the template declares, so no attribute on the box itself holds it.
 */
export function fieldBox(scope: Page | Locator, label: string, tag: 'input' | 'textarea' = 'input'): Locator {
  return scope.locator(tag).and(scope.getByLabel(label, { exact: true }));
}
