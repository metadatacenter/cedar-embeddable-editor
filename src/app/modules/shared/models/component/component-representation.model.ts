import {CedarComponent} from './cedar-component.model';

export interface ComponentRepresentation extends CedarComponent {

  className: string;
  children: CedarComponent[];

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
