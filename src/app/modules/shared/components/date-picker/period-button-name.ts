/**
 * Keeps the calendar's period button named by the period it shows, as Material does not.
 *
 * Material names the button by what it does, `Choose month and year`, and hides the `01/2026` it
 * shows from assistive technology, so a speech user saying what is on the button reaches nothing
 * (WCAG 2.5.3). The name here begins with that text and ends with Material's own.
 *
 * Material's header is not replaced to do this. A datepicker given a header component of its own
 * lets the calendar's height follow its content, which changes the calendar on screen. So the
 * calendar is watched instead: the button is named once Material has drawn it, and again whenever
 * Material rewrites its name or the period it shows changes.
 */
export class PeriodButtonName {
  private observer: MutationObserver | null = null;

  attach(calendar: Element): void {
    this.detach();
    let written: string | null = null;
    let action = '';
    const restate = (): void => {
      const button = calendar.querySelector('.mat-calendar-period-button');
      if (button === null) {
        return;
      }
      const label = button.getAttribute('aria-label') ?? '';
      if (label !== written) {
        action = label;
      }
      const shown = button.textContent?.trim() ?? '';
      const name = shown === '' ? action : `${shown}, ${action}`;
      if (label !== name) {
        written = name;
        button.setAttribute('aria-label', name);
      }
    };
    restate();
    this.observer = new MutationObserver(restate);
    this.observer.observe(calendar, {
      attributes: true,
      attributeFilter: ['aria-label'],
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  detach(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
