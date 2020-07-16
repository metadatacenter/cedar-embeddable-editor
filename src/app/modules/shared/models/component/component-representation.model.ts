import {CedarModel} from '../cedar-model.model';

export interface ComponentRepresentation {

  // Generic
  inputType: string;
  name: string;
  requiredValue: boolean;

  source: object;

  // Value
  defaultValue: string;
  minLength: number;
  maxLength: number;

  // Numeric
  numberType: string;
  unitOfMeasure: string;
  minValue: number;
  maxValue: number;
  decimalPlace: number;

  // Multiple
  readonly multiple: boolean;
}
