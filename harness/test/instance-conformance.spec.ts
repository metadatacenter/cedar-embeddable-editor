import { describe, expect, it } from 'vitest';
import { CARDINALITIES, FIELD_KINDS } from '../src/axes';
import { corpusTemplates } from '../src/corpus';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { validateWithModel } from '../src/instance-conformance';

/**
 * Does what CEE emits satisfy the template it came from?
 *
 * The model library answers the semantic half:
 * `InstanceValidator.validate` walks the instance against the parsed template
 * and reports what does not fit.  The separate population-matrix suite also
 * validates the exact emitted document against the unparsed Draft-04 template
 * schema, because parsing can legitimately repair a legacy shape and thereby
 * hide what the resource server will see.
 *
 * Worth being clear about what this does and does not test. It is not checking
 * the library — the library has its own suite for that. It is checking the tree
 * CEE hands the library, which the library cannot check on CEE's behalf because
 * it serialises faithfully whatever it is given: a field that lost its `@type`
 * is written back without one, and a property CEE never built cannot be
 * invented. Every defect below reached a saved document while the rest of this
 * suite stayed green.
 */
const VALUED = FIELD_KINDS.filter((k) => !k.isStatic);

const conformance = (template: object, driver: CeeDriver) => validateWithModel(template, driver.emitted);

const cases = VALUED.flatMap((kind, i) => CARDINALITIES.map((c) => [`${kind.key}/${c}`, i, c] as const));

describe('a freshly opened template', () => {
  it.each(cases)('%s produces an instance that satisfies it', (_label, index, cardinality) => {
    const kind = VALUED[index];
    const template = buildTemplate({
      name: `conf_${kind.key}_${cardinality}`,
      children: [
        {
          kind,
          name: 'f',
          cardinality: cardinality === 'multi' ? 'multi' : undefined,
          minItems: cardinality === 'multi' ? 2 : undefined,
          maxItems: cardinality === 'multi' ? 5 : undefined,
        },
      ],
    });
    const outcome = conformance(template, new CeeDriver(template));
    expect(outcome.count, outcome.detail).toBe(0);
  });
});

/**
 * The skeleton is not where instances break. A field's empty slot carries
 * whatever the build put there, so it conforms by construction; what fails is
 * a *written* value whose shape no longer matches. Editing a temporal or
 * numeric field dropped the `@type` its schema requires, and only a filled
 * field shows it.
 */
describe('a populated template', () => {
  /**
   * A part-filled multi choice field does not satisfy its template, and should
   * not.
   *
   * `minItems` means different things to the two shapes that carry it. On a
   * multi-instance text field it is how many slots exist, and the builder pads
   * to it. On a choice field the array holds what the user ticked, so a group
   * declaring `minItems: 2` with one option ticked is a constraint not yet met —
   * an ordinary state a form passes through on the way to being filled in, not a
   * defect in what CEE wrote.
   *
   * The widget confirms it: `cedar-input-checkbox` passes `formArray.value`, the
   * options actually selected, so one tick really is a one-element array. The
   * harness models that faithfully.
   *
   * So the interesting assertion is not that these conform — they should not —
   * but that CEE and the library agree about why. CEE's own data quality report
   * raises `minItems` on the same field, which is the answer a user sees; the
   * validator raises `missingIndexInRealObject` on the same path, which is the
   * answer the document gets. Two implementations, one verdict.
   *
   * `listSingle/multi` joined them when the model library stopped inferring
   * `multipleChoice` from cardinality and read it from `_valueConstraints`
   * instead. A single-choice list that repeats is a multi-instance field like
   * the others, so it starts with `minItems` slots and one written value leaves
   * the rest empty — the same part-filled state, reached by a field whose choice
   * is single.
   */
  const PART_FILLED_CHOICE = ['checkbox/multi', 'listMulti/multi', 'listSingle/multi'];

  it.each(cases)('%s still satisfies it once a value is written', (label, index, cardinality) => {
    const kind = VALUED[index];
    const template = buildTemplate({
      name: `confv_${kind.key}_${cardinality}`,
      children: [
        {
          kind,
          name: 'f',
          cardinality: cardinality === 'multi' ? 'multi' : undefined,
          minItems: cardinality === 'multi' ? 2 : undefined,
          maxItems: cardinality === 'multi' ? 5 : undefined,
        },
      ],
    });
    const driver = new CeeDriver(template);
    driver.setValue(['_f'], kind);
    const outcome = conformance(template, driver);

    if (PART_FILLED_CHOICE.includes(label)) {
      expect(outcome.detail).toContain('missingIndexInRealObject');
      // `qualityReport` is a JSON round trip and so is typed `any`; name the one
      // member this reads rather than letting the parameter infer to `any`,
      // which the harness's `strict` no longer allows.
      const reported = driver.qualityReport.problems.map((problem: { code: string }) => problem.code);
      expect(reported, 'CEE should raise minItems where the validator does').toContain('minItems');
      return;
    }
    expect(outcome.count, outcome.detail).toBe(0);
  });
});

describe('the shared corpus', () => {
  it.each(corpusTemplates().map((t) => [t.id, t] as const))(
    'template-%s produces an instance that satisfies it',
    (_id, artifact) => {
      const outcome = conformance(artifact.json, new CeeDriver(artifact.json));
      expect(outcome.count, outcome.detail).toBe(0);
    },
  );
});
