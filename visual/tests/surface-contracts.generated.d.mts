import type { Page, TestInfo, expect } from '@playwright/test';
export interface Surface {
  id: string;
  name: string;
  contract: string;
  selector: string;
  scenario: string;
  states: string[];
  debt?: Record<string, { actual: string; expected: string; reason: string }>;
}
export function surfaceCases(
  registry: { surfaces: Surface[] },
  scenarios: Record<string, (page: Page) => Promise<void>>,
): Array<{ surface: Surface; state: string; width: number; title: string }>;
export function checkSurface(
  page: Page,
  surface: Surface,
  state: string,
  assertions: typeof expect,
  testInfo: TestInfo,
): Promise<void>;
