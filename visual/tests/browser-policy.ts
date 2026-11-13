import { expect, test, type Locator, type Page } from '@playwright/test';

/** Pure pixel comparisons keep their existing Chromium desktop/narrow baselines. */
export const PIXEL_ONLY = '@pixel-only';

export function pixelBaselinesEnabled(): boolean {
  return (test.info().project.use.browserName ?? 'chromium') === 'chromium';
}

/** Mixed journeys keep their functional assertions in every engine and compare pixels in Chromium. */
export async function expectPixelBaseline(
  target: Locator | Page,
  name: string,
  options?: { fullPage?: boolean },
): Promise<void> {
  if (!pixelBaselinesEnabled()) return;
  await expect(target).toHaveScreenshot(name, options);
}
