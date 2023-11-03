import { FieldComponent } from '../component/field-component.model';
import { MultiComponent } from '../component/multi-component.model';
import { MultiInfo } from '../info/multi-info.model';
import { AbstractFieldComponent } from './abstract-field-component.model';
import { InputType } from '../input-type.model';

export class MultiFieldComponent extends AbstractFieldComponent implements MultiComponent, FieldComponent {
  className = 'MultiFieldComponent';
  multiInfo: MultiInfo = new MultiInfo();

  isMulti(): boolean {
    return true;
  }

  isMultiPage(): boolean {
    const inputType = this.basicInfo.inputType;
    return !(inputType === InputType.checkbox || inputType === InputType.list);
  }
}
