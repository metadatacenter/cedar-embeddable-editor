import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { aroundLabel, AroundLabel, LABEL_SLOT } from '../../a11y/joined-name';

/**
 * A control's name that joins CEE's words to a label the template wrote, such as `date, select date`,
 * for the control to take through `aria-labelledby`.
 *
 * An `aria-label` is one string, so it cannot say that its words and its label are in different
 * languages. This element holds the name as text instead, with the label in an element of its own
 * marked with the language the template declares for it. CEE's words take CEE's language from the
 * root.
 *
 * The text is hidden from sight and, since the control it names reads it, from reading too. It stays
 * rendered: Chromium joins the text of a `display: none` element with a space between each of its
 * children, which would put a space before the comma that follows the label.
 */
@Component({
  selector: 'span[appCedarJoinedName]',
  template:
    '@let around = split(key | translate: slot);' +
    '{{ around.before }}' +
    '@if (around.labelled) {<span [attr.lang]="labelLanguage">{{ label }}</span>}' +
    '{{ around.after }}',
  host: { class: 'cdk-visually-hidden', 'aria-hidden': 'true', '[id]': 'id' },
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarJoinedNameComponent {
  private static nextId = 0;

  /** The id the named control's `aria-labelledby` refers to. */
  readonly id = `cee-joined-name-${CedarJoinedNameComponent.nextId++}`;

  /** The translation key of the name, whose `label` parameter the label fills. */
  @Input({ required: true }) key!: string;

  /** The label the template wrote, as the form shows it. */
  @Input() label = '';

  /** The language the template declares for its text, as a `lang` tag, or null where it declares none. */
  @Input() labelLanguage: string | null = null;

  protected readonly slot = { label: LABEL_SLOT };

  protected split(translated: string): AroundLabel {
    return aroundLabel(translated);
  }
}
