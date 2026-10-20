// @vitest-environment jsdom
import { PeriodButtonName } from './period-button-name';

describe('PeriodButtonName', () => {
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

  const calendar = document.createElement('div');
  document.body.appendChild(calendar);

  const periodButton = (shown: string, label: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.className = 'mat-calendar-period-button';
    button.setAttribute('aria-label', label);
    button.innerHTML = `<span aria-hidden="true">${shown}</span>`;
    calendar.replaceChildren(button);
    return button;
  };

  it('names the button by the period it shows, then by what it does', () => {
    const button = periodButton('01/2026', 'Choose month and year');
    const namer = new PeriodButtonName();
    namer.attach(calendar);
    expect(button.getAttribute('aria-label')).toBe('01/2026, Choose month and year');
    namer.detach();
  });

  it('names the button once Material draws it', async () => {
    calendar.replaceChildren();
    const namer = new PeriodButtonName();
    namer.attach(calendar);
    const button = periodButton('01/2026', 'Choose month and year');
    await settle();
    expect(button.getAttribute('aria-label')).toBe('01/2026, Choose month and year');
    namer.detach();
  });

  it('follows the period and the label Material writes', async () => {
    const button = periodButton('01/2026', 'Choose month and year');
    const namer = new PeriodButtonName();
    namer.attach(calendar);

    button.querySelector('span')!.textContent = '02/2026';
    await settle();
    expect(button.getAttribute('aria-label')).toBe('02/2026, Choose month and year');

    button.querySelector('span')!.textContent = '2016 – 2039';
    button.setAttribute('aria-label', 'Choose date');
    await settle();
    expect(button.getAttribute('aria-label')).toBe('2016 – 2039, Choose date');

    namer.detach();
    button.setAttribute('aria-label', 'Choose month and year');
    await settle();
    expect(button.getAttribute('aria-label')).toBe('Choose month and year');
  });
});
