/**
 * What the data quality report is, as opposed to what it says.
 *
 * The report used to carry three of CEE's working views alongside its answer:
 * the parsed component tree, the instance, and a value tree mirroring the
 * template. Across the 56 paired cases in the compatibility corpus those three
 * were 99.6% of its bytes — the largest, case 071, produced a 1.3 MB file whose
 * content was five problems. None of the three was read by CEE, by the CEDAR
 * workspace or by `CeeDataQualityReport`, and the component tree carried
 * `pageBreakChildren`, a verbatim second copy of the children beside it.
 *
 * They are gone, and these hold them gone. `cee-public-api.spec.ts` guards the
 * declaration; this guards the object and the file a host downloads, which is
 * where an internal view would actually surface.
 */
import { describe, expect, it } from 'vitest';
import { CeeDriver } from '../src/driver';
import { ceeSuiteCases } from '../src/corpus';
import { buildTemplate } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';
import { linkNode } from '../src/values';
import { downloadContentFor } from '@cee/util/download-content';

const TEXT = FIELD_KINDS.find((k) => k.inputType === 'textfield')!;
const CONTROLLED = FIELD_KINDS.find((k) => k.inputType === 'controlled')!;

const MEMBERS = ['isValid', 'nonNullRequiredFieldValueCount', 'problems', 'requiredFieldValueCount'];

const paired = ceeSuiteCases().filter((c) => c.template !== null && c.instance !== null);

const driverFor = (id: string): CeeDriver => {
  const c = paired.find((x) => x.id === id)!;
  return new CeeDriver(c.template as object, { instance: c.instance as object });
};

describe('the report carries nothing but its answer', () => {
  it.each(paired.map((c) => c.id))('case %s reports exactly the four contracted members', (id) => {
    expect(Object.keys(driverFor(id).qualityReport).sort()).toEqual(MEMBERS);
  });

  /**
   * The names, rather than a shape test, because each one identifies a specific
   * thing that used to leak. `_id` and `_iris` are CEE's spellings of `@id`;
   * `className`, `pageBreakChildren` and `parsed` are the component tree;
   * `dataContainer` is the instance model's own container.
   */
  const INTERNALS = ['"_id"', '"_values"', '"_iris"', '"dataContainer"', '"className"', '"pageBreakChildren"', '"parsed"'];

  it.each(paired.map((c) => c.id))('case %s downloads a report with no internals in it', (id) => {
    const content = downloadContentFor('dataQuality', driverFor(id).dataContext);
    expect(INTERNALS.filter((needle) => content.includes(needle))).toEqual([]);
  });

  /**
   * A ceiling, not a measurement. Case 071 is the corpus's largest template and
   * its report was 1,325,298 bytes; it is 1,806 now, and five problems is the
   * most any corpus case reports. A dump reintroduced anywhere in the report
   * fails here whatever it is called, which the name list above cannot promise.
   */
  it('does not grow back', () => {
    expect(downloadContentFor('dataQuality', driverFor('071').dataContext).length).toBeLessThan(8000);
  });
});

/**
 * A problem's `value` is published contract, and an atom serialises by its
 * private fields — so a host reading the offending value of a controlled term
 * got `{"_id": "…"}`, CEE's own spelling. The library writes the node now.
 */
describe('a problem names the offending value as CEDAR writes it', () => {
  it('gives a controlled term with no label as an @id document', () => {
    const template = buildTemplate({ name: 'pv', children: [{ kind: CONTROLLED, name: 'term' }] });
    const driver = new CeeDriver(template, {
      instance: {
        '@context': {},
        'schema:isBasedOn': (template as Record<string, string>)['@id'],
        _term: linkNode('https://example.org/t/1'),
      },
    });

    const problem = driver.qualityReport.problems.find((p: { code: string }) => p.code === 'controlledStructure');
    expect(problem, 'the corpus shape that produces this problem stopped producing it').toBeDefined();
    expect(problem.value).toEqual({ '@id': 'https://example.org/t/1' });
  });
});

/**
 * One count per required field the template declares, whatever its cardinality.
 *
 * A multi field used to contribute one count per occurrence while a required
 * field inside a repeated element contributed one, so a single report's pair of
 * numbers meant two different things. Neither was ever per occurrence — one
 * `satisfiedBy` answered for all of them — so three occurrences of a required
 * field with one filled reported "3 of 3". The verdict was right; the number a
 * host puts on screen was not.
 */
describe('required counting', () => {
  const counts = (driver: CeeDriver) => {
    const report = driver.qualityReport;
    return {
      required: report.requiredFieldValueCount,
      filled: report.nonNullRequiredFieldValueCount,
      isValid: report.isValid,
    };
  };

  it('counts a required single field once', () => {
    const driver = new CeeDriver(buildTemplate({ name: 'rc1', children: [{ kind: TEXT, name: 'r', required: true }] }));
    expect(counts(driver)).toEqual({ required: 1, filled: 0, isValid: false });
    expect(driver.qualityReport.problems).toEqual([
      expect.objectContaining({
        path: ['_r'],
        field: '_r',
        inputType: 'textfield',
        code: 'required',
        value: null,
      }),
    ]);
    driver.setValue(['_r'], TEXT, 'x');
    expect(counts(driver)).toEqual({ required: 1, filled: 1, isValid: true });
    expect(driver.qualityReport.problems).toEqual([]);
  });

  it('counts a required multi field once, not once per occurrence', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'rc2',
        children: [{ kind: TEXT, name: 'r', required: true, cardinality: 'multi', minItems: 3, maxItems: 5 }],
      }),
    );
    expect(counts(driver)).toEqual({ required: 1, filled: 0, isValid: false });
    expect(driver.qualityReport.problems.map((p: { code: string }) => p.code)).toContain('required');
    driver.setValue(['_r'], TEXT, 'first occurrence only');
    expect(counts(driver)).toEqual({ required: 1, filled: 1, isValid: true });
    expect(driver.qualityReport.problems.map((p: { code: string }) => p.code)).not.toContain('required');
  });

  it('counts a required field in a repeated element once', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'rc3',
        elements: [
          { name: 'el', cardinality: 'multi', minItems: 3, children: [{ kind: TEXT, name: 'r', required: true }] },
        ],
      }),
    );
    expect(counts(driver)).toEqual({ required: 1, filled: 0, isValid: false });
    expect(driver.qualityReport.problems).toEqual([
      expect.objectContaining({ path: ['_el', '_r'], field: '_r', code: 'required' }),
    ]);
    driver.setValue(['_el', '_r'], TEXT, 'first occurrence only');
    expect(counts(driver)).toEqual({ required: 1, filled: 1, isValid: true });
    expect(driver.qualityReport.problems).toEqual([]);
  });

  /**
   * VERDICT CHANGE, and the only one across the 178 fixtures: a required multi
   * field holding nothing is now unsatisfied rather than unrequired.
   *
   * The count used to be taken inside the loop over occurrences, so a field with
   * no occurrences contributed nothing — its requirement did not go unmet, it
   * ceased to exist, and the instance reported valid. Compatibility case 081 is
   * exactly this shape: `requiredValue: true` with `minItems: 0`, so CEE builds
   * an empty array for it and the old report called that complete.
   *
   * Advisory rather than something the artifact REST API would refuse: `[]`
   * satisfies the template's JSON Schema when the floor is zero, because
   * `requiredValue` is a `_valueConstraints` notion the canonical validator does
   * not enforce. It is the same answer CEE has always given for a required
   * single field left empty.
   */
  it('treats a required multi field with no occurrences as unfilled', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'rc_zero',
        children: [{ kind: TEXT, name: 'r', required: true, cardinality: 'multi', minItems: 0, maxItems: 3 }],
      }),
    );
    expect(counts(driver)).toEqual({ required: 1, filled: 0, isValid: false });
  });

  /**
   * The two shapes in one template, which is where the old pair was unlabelable:
   * it read 4, being three occurrence slots plus one declaration.
   */
  it('gives the two shapes the same weight', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'rc4',
        children: [{ kind: TEXT, name: 'reason', required: true, cardinality: 'multi', minItems: 3, maxItems: 5 }],
        elements: [
          { name: 'author', cardinality: 'multi', minItems: 3, children: [{ kind: TEXT, name: 'email', required: true }] },
        ],
      }),
    );
    driver.setValue(['_reason'], TEXT, 'a reason');
    driver.setValue(['_author', '_email'], TEXT, 'a@example.org');
    expect(counts(driver)).toEqual({ required: 2, filled: 2, isValid: true });
  });
});
