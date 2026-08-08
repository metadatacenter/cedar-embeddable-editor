import { ChoiceOption } from './choice-option.model';

export class ChoiceInfo {
  /** Whether the field takes more than one of its choices. Only list fields declare it. */
  multipleChoice = false;
  choices: ChoiceOption[] = [];
}
