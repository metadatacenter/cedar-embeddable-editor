import { ChoiceOption } from './choice-option.model';

export class ChoiceInfo {
  multipleChoice: boolean;
  // multipleChoice: number;
  choices: ChoiceOption[] = [];
}
