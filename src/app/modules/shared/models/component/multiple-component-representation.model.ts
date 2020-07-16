import {ComponentRepresentation} from './component-representation.model';

export class MultipleComponentRepresentation implements ComponentRepresentation {

  inputType: string;
  name: string;
  source: object;
  requiredValue: boolean;

  defaultValue: string;
  minItems: number;
  maxItems: number;

  minLength: number;
  maxLength: number;

  numberType: string;
  unitOfMeasure: string;
  minValue: number;
  maxValue: number;
  decimalPlace: number;

  readonly multiple: boolean = true;

}
