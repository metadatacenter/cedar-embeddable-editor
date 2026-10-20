// @vitest-environment jsdom
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { AnnouncedMessage, DescriptionLink, WidgetMessage } from './message-links';

describe('DescriptionLink', () => {
  const control = (describedBy?: string): HTMLInputElement => {
    const input = document.createElement('input');
    if (describedBy !== undefined) input.setAttribute('aria-describedby', describedBy);
    return input;
  };

  it('adds its id beside the ids others wrote, and takes only its own away', () => {
    const first = control('mat-mdc-error-1');
    const second = control();
    const link = new DescriptionLink();

    link.set('problems', [first, second]);
    expect(first.getAttribute('aria-describedby')).toBe('mat-mdc-error-1 problems');
    expect(second.getAttribute('aria-describedby')).toBe('problems');

    link.set('problems', [first]);
    expect(second.hasAttribute('aria-describedby')).toBe(false);

    link.set(null, [first]);
    expect(first.getAttribute('aria-describedby')).toBe('mat-mdc-error-1');
  });

  it('restores its id where something else rewrote the attribute', () => {
    const input = control();
    const link = new DescriptionLink();
    link.set('message', [input]);
    input.setAttribute('aria-describedby', 'rewritten');
    link.set('message', [input]);
    expect(input.getAttribute('aria-describedby')).toBe('rewritten message');
    link.clear();
    expect(input.getAttribute('aria-describedby')).toBe('rewritten');
  });
});

describe('AnnouncedMessage', () => {
  const announcer = (): { announce: ReturnType<typeof vi.fn> } => ({ announce: vi.fn(() => Promise.resolve()) });

  it('announces a message that appears or changes, but not one the form opened with', () => {
    const live = announcer();
    const message = new AnnouncedMessage(live as unknown as LiveAnnouncer);
    message.check('Already wrong');
    message.check('Already wrong');
    expect(live.announce).not.toHaveBeenCalled();

    message.check('');
    message.check('Now wrong');
    message.check('Now wrong');
    message.check('Wrong again');
    expect(live.announce.mock.calls.map(([text]) => text)).toEqual(['Now wrong', 'Wrong again']);
  });
});

describe('WidgetMessage', () => {
  it('links the element showing the message while it is shown, and announces it once', () => {
    const live = { announce: vi.fn(() => Promise.resolve()) };
    const message = new WidgetMessage(live as unknown as LiveAnnouncer);
    const box = document.createElement('input');
    message.check(null, [box]);

    const error = document.createElement('mat-error');
    error.id = message.id;
    error.textContent = ' Select at least one. ';
    message.check(error, [box]);
    expect(box.getAttribute('aria-describedby')).toBe(message.id);
    expect(live.announce).toHaveBeenCalledWith('Select at least one.', 'polite', 10_000);

    message.check(null, [box]);
    expect(box.hasAttribute('aria-describedby')).toBe(false);
  });
});
