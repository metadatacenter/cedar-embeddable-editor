import {ComponentRepresentation} from './component-representation.model';

export class SingleComponentRepresentation implements ComponentRepresentation {

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

  readonly multiple: boolean = false;

}
