import { TemplateComponent } from './template/template-component.model';
import { InstanceExtractData } from './instance-extract-data.model';
import { ValidationProblem } from '../validation/validation-problem.model';

export class DataQualityReport extends Object {
  templateRepresentation: TemplateComponent;
  instanceExtractData: InstanceExtractData;
  valueTree: object;
  requiredFieldValueCount = 0;
  nonNullRequiredFieldValueCount = 0;
  /**
   * Constraint violations, one per problem. Empty when every present value
   * satisfies its declared constraints.
   *
   * The counters above answer "is anything missing"; this answers "is anything
   * wrong", which the report could not express before.
   */
  problems: ValidationProblem[] = [];
  isValid = false;

  constructor() {
    super();
  }

  /** True when nothing required is missing and no present value is invalid. */
  computeValidity() {
    const nothingMissing = this.requiredFieldValueCount <= this.nonNullRequiredFieldValueCount;
    this.isValid = nothingMissing && this.problems.length === 0;
  }
}
