/**
 * What announcing needs of CDK's `LiveAnnouncer`.
 *
 * Stated here rather than imported, so these helpers can be exercised without Angular. The
 * element's own announcer is what widgets pass.
 */
export interface Announcer {
  announce(message: string, politeness: 'polite', duration: number): Promise<void>;
}

/**
 * The controls in a field's widget, which what is said about the field describes: its problems and
 * its description. A widget's buttons act on the value rather than hold it, so they are left out.
 */
export const FIELD_CONTROLS = 'input, textarea, mat-select';

const idsOf = (element: Element): string[] =>
  (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);

const writeIds = (element: Element, ids: string[]): void => {
  if (ids.length > 0) {
    element.setAttribute('aria-describedby', ids.join(' '));
  } else {
    element.removeAttribute('aria-describedby');
  }
};

/**
 * One message's place in some controls' `aria-describedby`, kept beside the ids others put there.
 *
 * Material writes the ids of the errors and hints inside a form field, and keeps any id it did not
 * write. A message drawn outside a form field reaches its control this way: whoever draws it says,
 * after each render, which controls it describes, and this adds its id to those and removes it from
 * any others.
 */
export class DescriptionLink {
  private id: string | null = null;
  private elements: readonly Element[] = [];

  /** Make exactly `elements` refer to the message `id`, or none of them when there is no message. */
  set(id: string | null, elements: readonly Element[]): void {
    const described = id === null ? [] : elements;
    for (const element of this.elements) {
      if (this.id !== null && (this.id !== id || !described.includes(element))) {
        writeIds(
          element,
          idsOf(element).filter((existing) => existing !== this.id),
        );
      }
    }
    for (const element of described) {
      const ids = idsOf(element);
      if (id !== null && !ids.includes(id)) {
        writeIds(element, [...ids, id]);
      }
    }
    this.id = id;
    this.elements = described;
  }

  clear(): void {
    this.set(null, []);
  }
}

/**
 * Says a message aloud when it appears or changes, without moving focus.
 *
 * Checked after each render with the text the message shows, or nothing while none is drawn. The
 * first check only records it, so a form opening with a message already on screen announces
 * nothing. Material's form fields announce their own errors, so this is for the messages drawn
 * outside one.
 */
export class AnnouncedMessage {
  /**
   * How long an announcement stays in the region, as long as a select's own. The region is hidden
   * from sight but not from a screen reader's reading of the page, so a message is not left there.
   */
  private static readonly DURATION = 10_000;
  private shown: string | null = null;

  constructor(private readonly announcer: Announcer | null) {}

  check(text: string): void {
    const previous = this.shown;
    this.shown = text;
    if (previous !== null && text !== '' && text !== previous) {
      void this.announcer?.announce(text, 'polite', AnnouncedMessage.DURATION);
    }
  }
}

let messageCount = 0;

/**
 * A message a widget draws outside any form field, linked to the controls it is about and
 * announced when it appears.
 *
 * The widget checks it after each render with the element showing the message, or null while
 * there is none, and the controls the message concerns.
 */
export class WidgetMessage {
  /** The id the widget gives the element showing the message. Unique within the page. */
  readonly id = `cee-widget-message-${messageCount++}`;
  private readonly link = new DescriptionLink();
  private readonly announcement: AnnouncedMessage;

  constructor(announcer: Announcer | null) {
    this.announcement = new AnnouncedMessage(announcer);
  }

  check(message: Element | null, controls: Iterable<Element>): void {
    this.link.set(message === null ? null : this.id, message === null ? [] : [...controls]);
    this.announcement.check(message?.textContent?.trim() ?? '');
  }

  clear(): void {
    this.link.clear();
  }
}
