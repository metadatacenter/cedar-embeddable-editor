import { ValidationProblem } from '../validation/validation-problem.model';

/**
 * What CEE thinks of the instance in the form.
 *
 * Everything here is answer. The report carried three working views alongside
 * it — the component tree, the instance, and a value tree mirroring the
 * template — and across the 56 paired cases in the compatibility corpus those
 * three were 99.6% of its bytes. None was read by CEE, by the CEDAR workspace
 * or by the published contract, and two of them were data the host already
 * held: the instance it supplied, and the template it supplied. The third was
 * derivable from the first two.
 *
 * So the file a host downloads and the interface it programs against are now
 * the same four members, rather than the second being a subset of the first.
 */
export class DataQualityReport extends Object {
  /** How many required fields the template declares. */
  requiredFieldValueCount = 0;
  /** How many of those the instance fills. */
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
