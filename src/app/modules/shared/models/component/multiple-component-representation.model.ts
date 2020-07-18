import {ComponentRepresentation} from './component-representation.model';
import {CedarComponent} from './cedar-component.model';
import {MultiInfo} from '../info/multi-info.model';

export class MultipleComponentRepresentation implements ComponentRepresentation {

  className = 'MultipleComponentRepresentation';
  children: CedarComponent[] = [];

  multiInfo: MultiInfo = new MultiInfo();

  inputType: string;
  name: string;
  source: object;
  requiredValue: boolean;

  defaultValue: string;

  minLength: number;
  maxLength: number;

  numberType: string;
  unitOfMeasure: string;
  minValue: number;
  maxValue: number;
  decimalPlace: number;

  readonly multiple: boolean = true;

}
