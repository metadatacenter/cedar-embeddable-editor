/**
 * One option of a checkbox, radio or select field.
 *
 * Built in one place, from one literal, and never changed afterwards — so the
 * values arrive through the constructor rather than being assigned onto an empty
 * instance a line at a time.
 */
export class ChoiceOption {
  constructor(
    /**
     * The option's text, which is also its identity: it names the form control, it
     * is the dropdown entry's id and its text, and it is what the instance holds
     * when the option is chosen. So a literal declaring no label is the
     * empty-labelled option rather than an option without one.
     */
    public readonly label: string,
    public readonly selectedByDefault: boolean,
  ) {}
}
