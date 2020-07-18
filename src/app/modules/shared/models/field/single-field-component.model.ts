import {FieldComponent} from '../component/field-component.model';
import {SingleComponent} from '../component/single-component.model';
import {BasicInfo} from '../info/basic-info.model';
import {ValueInfo} from '../info/value-info.model';
import {NumberInfo} from '../info/number-info.model';
import {ChoiceInfo} from '../info/choice-info.model';

export class SingleFieldComponent implements SingleComponent, FieldComponent {

  className = 'SingleFieldComponent';
  name: string;
  basicInfo: BasicInfo = new BasicInfo();
  valueInfo: ValueInfo = new ValueInfo();
  numberInfo: NumberInfo = new NumberInfo();
  choiceInfo: ChoiceInfo = new ChoiceInfo();

}
