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
   * Validation problems, including one `required` problem for each unfilled
   * required field declaration and constraint violations on present values.
   */
  problems: ValidationProblem[] = [];
  isValid = false;
  /** Whether the instance representation has any structural defect. */
  structurallyValid = false;
  /** Instance save policy: value-quality and completeness findings are advisory. */
  canSave = false;
  /** Every applicable semantic check, including checks that could not run. */
  semanticChecks: SemanticVerification[] = [];
  /** Present while worker checks are unresolved; no provisional answer is advertised as valid. */
  declare pendingValidation?: boolean;

  constructor() {
    super();
  }

  /** True when nothing required is missing and no present value is invalid. */
  computeValidity() {
    if (this.problems.some((problem) => problem.code === 'regexPending')) {
      this.pendingValidation = true;
      this.problems = this.problems.filter((problem) => problem.code !== 'regexPending');
    }
    const nothingMissing = this.requiredFieldValueCount <= this.nonNullRequiredFieldValueCount;
    this.structurallyValid = !this.problems.some((problem) => problem.blocksSave);
    this.canSave = this.structurallyValid && !this.pendingValidation;
    this.isValid =
      !this.pendingValidation &&
      nothingMissing &&
      this.problems.length === 0 &&
      this.semanticChecks.every((check) => check.status === 'passed');
  }
}

export interface SemanticVerification {
  path: string[];
  occurrences: number[];
  iri: string;
  status: 'passed' | 'failed' | 'notChecked' | 'unavailable';
  code: string;
  message: string;
}
