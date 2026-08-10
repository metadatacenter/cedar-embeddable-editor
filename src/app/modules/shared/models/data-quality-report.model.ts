import { TemplateComponent } from './template/template-component.model';
import { JsonNode } from 'cedar-model-typescript-library';
import { ValidationProblem } from '../validation/validation-problem.model';

export class DataQualityReport extends Object {
  /** Null when a report is built before a template is set, which produces an empty one. */
  templateRepresentation: TemplateComponent | null = null;
  /**
   * The instance the report describes, as the document a host page reads.
   *
   * This was the envelope-free *view* of the working tree, which was a document
   * itself, so handing it out cost nothing. The tree is a model now: handing a
   * host page the model's container would show it `_values` and `_iris`, and
   * there is no reason a consumer of a report should see CEE's internals. A
   * written instance is what one is.
   */
  instance: JsonNode | null = null;
  valueTree: object = {};
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
