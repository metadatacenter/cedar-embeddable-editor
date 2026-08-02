/**
 * Cardinality, required values, and nesting depth.
 *
 * These three interact in ways single-axis tests miss. `requiredFieldValueCount`
 * counts a multi field once *per page*, path resolution consults `currentIndex`
 * at every multi ancestor, and `minItems` seeds the initial instance count — so
 * "one required multi field inside a multi element" is a genuinely different
 * case from any of its parts.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate, supportsMultiInstance } from '../src/generate';
import { CeeDriver } from '../src/driver';

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;
const TEXT = kind('textfield');

const countOf = (d: CeeDriver, c: any) =>
  d.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(c).currentCount;

describe('minItems seeds the initial instance count', () => {
  it.each([0, 1, 2, 5])('a multi element with minItems=%i starts with that many', (minItems) => {
    const driver = new CeeDriver(
      buildTemplate({
        name: `min_${minItems}`,
        elements: [{ name: 'el', cardinality: 'multi', minItems, children: [{ kind: TEXT, name: 'f' }] }],
      }),
    );
    expect(countOf(driver, driver.findOrThrow(['_el']))).toBe(minItems);
  });

  it.each([0, 1, 3])('a multi field with minItems=%i builds that many value slots', (minItems) => {
    const driver = new CeeDriver(
      buildTemplate({
        name: `fmin_${minItems}`,
        children: [{ kind: TEXT, name: 'f', cardinality: 'multi', minItems }],
      }),
    );
    expect(driver.extract._f).toHaveLength(minItems);
  });

  /**
   * `minItems: 0` leaves `currentIndex` at -1, which is the empty-pager state.
   * `copyMultiInstance` explicitly falls back to `addMultiInstance` in that
   * case — there is nothing to copy from.
   */
  it('copying an empty multi element adds rather than throwing', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'copy_empty',
        elements: [{ name: 'el', cardinality: 'multi', minItems: 0, children: [{ kind: TEXT, name: 'f' }] }],
      }),
    );
    const el = driver.findOrThrow(['_el']);
    expect(countOf(driver, el)).toBe(0);

    driver.handlerContext.copyMultiInstance(el);

    expect(countOf(driver, el)).toBe(1);
    driver.expectNoErrors('copy from empty');
  });
});

describe('required values', () => {
  /**
   * Attribute-value fields are excluded: they emit no `_valueConstraints` at
   * all, so `requiredValue` never reaches the template and CEE reads
   * `valueInfo.requiredValue` as undefined. That is the CEDAR model's design —
   * an attribute-value field is a dynamic key/value pair, not a slot that can
   * be required — not a CEE defect.
   */
  const requirable = FIELD_KINDS.filter((k) => !k.isStatic && k.key !== 'attrValue');

  /**
   * Fields whose value is written as a bare `@id` with no `@value`.
   * `DataQualityReportBuilderHandler.extractPlainValue` only recognises the IRI
   * for `InputType.link`; see the known-defects block below.
   */
  const IRI_VALUED_NON_LINK = ['ext-orcid', 'ext-ror'];

  it.each(requirable.map((k) => [k.key, k] as const))('%s counts once when required and single', (_key, k) => {
    const driver = new CeeDriver(
      buildTemplate({ name: `req_${k.key}`, children: [{ kind: k, name: 'f', required: true }] }),
    );
    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(0);
  });

  it.each(requirable.filter((k) => !IRI_VALUED_NON_LINK.includes(k.inputType)).map((k) => [k.key, k] as const))(
    '%s satisfies its requirement once filled',
    (_key, k) => {
      const driver = new CeeDriver(
        buildTemplate({ name: `reqf_${k.key}`, children: [{ kind: k, name: 'f', required: true }] }),
      );
      driver.setValue(['_f'], k);
      expect(driver.qualityReport.nonNullRequiredFieldValueCount, `${k.key} did not register as filled`).toBe(1);
      expect(driver.qualityReport.isValid).toBe(true);
    },
  );

  it('does not count optional fields toward the requirement', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'req_mixed',
        children: [
          { kind: TEXT, name: 'a', required: true },
          { kind: TEXT, name: 'b' },
          { kind: TEXT, name: 'c' },
        ],
      }),
    );
    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);
  });

  /**
   * A required field inside a multi element is counted ONCE, not once per
   * instance. `buildRecursively` walks a multi element's children a single time
   * into a dummy object — incrementing the counters as it goes — then
   * `_.cloneDeep`s that dummy `currentCount` times into the value tree
   * (data-quality-report-builder.handler.ts:65-80). The clones never touch the
   * counters.
   *
   * Pinned as-is rather than asserted as "should scale", because changing it is
   * a product decision. See the known-defects block for the consequence.
   */
  it('counts a required field in a multi element once, regardless of instance count', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'req_multi_el',
        elements: [
          { name: 'el', cardinality: 'multi', minItems: 2, children: [{ kind: TEXT, name: 'f', required: true }] },
        ],
      }),
    );
    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);

    driver.handlerContext.addMultiInstance(driver.findOrThrow(['_el']));

    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);
  });
});

/**
 * Behaviours that look wrong, pinned so a fix is a deliberate, visible change.
 *
 * Each of these is a characterization test: it asserts what CEE *does*, not
 * what it arguably should do. If someone fixes one, the test fails and they
 * update it on purpose — which is the point.
 */
describe('known defects (characterized, not endorsed)', () => {
  /**
   * DEFECT: a filled required ORCID/ROR field never satisfies its requirement.
   *
   * `changeValue` stores these as `{'@id': <iri>}` with no `@value`.
   * `extractPlainValue` returns the IRI only when
   * `component.basicInfo.inputType === InputType.link`; for any other
   * IRI-valued type it falls through to the controlled-term branch and reads
   * `rdfs:label`, which is undefined here. `emptyToNull` turns that into null,
   * so the report counts the field as empty and `isValid` never becomes true.
   *
   * On `develop` this now affects seven input types, not two: the check is a
   * single `=== InputType.link`, while ext-orcid, ext-ror, ext-pfas,
   * ext-pubmed, ext-rrid, ext-nih-grant-id and ext-doi all store a bare `@id`.
   *
   * Fix would be to test membership of the IRI-valued set rather than equality
   * with `link` (data-quality-report-builder.handler.ts:155).
   */
  it.each([
    ['ext-orcid', 'orcid'],
    ['ext-ror', 'ror'],
  ])('%s: a filled required field still reports as empty', (inputType, key) => {
    const k = FIELD_KINDS.find((x) => x.key === key)!;
    expect(k.inputType).toBe(inputType);

    const driver = new CeeDriver(
      buildTemplate({ name: `defect_${key}`, children: [{ kind: k, name: 'f', required: true }] }),
    );
    driver.setValue(['_f'], k);

    // The value really is stored...
    const node: any = driver.handlerContext.getDataObjectNodeByPath(['_f']);
    expect(node['@id']).toBe(k.sample);

    // ...but the quality report cannot see it.
    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(0);
    expect(driver.qualityReport.isValid).toBe(false);
  });

  /**
   * DEFECT: filling one page of a multi element marks every page satisfied.
   *
   * Follows from the clone-the-dummy strategy above: the children are evaluated
   * once against whichever page `currentIndex` points at, so a required field
   * filled on page 0 makes the report valid while pages 1..n are still empty.
   * The instance is reported as complete when it is not.
   */
  it('reports valid after filling only the first page of a multi element', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'defect_pages',
        elements: [
          { name: 'el', cardinality: 'multi', minItems: 3, children: [{ kind: TEXT, name: 'f', required: true }] },
        ],
      }),
    );
    const el = driver.findOrThrow(['_el']);
    driver.handlerContext.setCurrentIndex(el, 0);
    driver.setValue(['_el', '_f'], TEXT, 'only page zero');

    expect(driver.qualityReport.isValid).toBe(true);

    // Pages 1 and 2 are demonstrably empty.
    for (const page of [1, 2]) {
      driver.handlerContext.setCurrentIndex(el, page);
      const node: any = driver.handlerContext.getDataObjectNodeByPath(['_el', '_f']);
      expect(node['@value'] ?? null, `page ${page} should be empty`).toBeNull();
    }
  });
});

describe('nesting depth', () => {
  const deepTemplate = () =>
    buildTemplate({
      name: 'deep',
      elements: [
        {
          name: 'outer',
          cardinality: 'multi',
          minItems: 2,
          children: [{ kind: TEXT, name: 'outer_f' }],
          elements: [
            {
              name: 'inner',
              cardinality: 'multi',
              minItems: 2,
              children: [{ kind: TEXT, name: 'inner_f' }],
            },
          ],
        },
      ],
    });

  it('builds a multi element inside a multi element', () => {
    const driver = new CeeDriver(deepTemplate());
    expect(driver.findOrThrow(['_outer'])).toBeTruthy();
    expect(driver.findOrThrow(['_outer', '_inner'])).toBeTruthy();
    expect(driver.findOrThrow(['_outer', '_inner', '_inner_f'])).toBeTruthy();
    driver.expectNoErrors('deep build');
  });

  /**
   * The real test of two-level cursor resolution: write a distinct value at
   * each (outer, inner) coordinate, then read every coordinate back. If either
   * cursor is ignored or applied at the wrong depth, values collide.
   */
  it('resolves values independently across two levels of multi cursors', () => {
    const driver = new CeeDriver(deepTemplate());
    const outer = driver.findOrThrow(['_outer']);
    const inner = driver.findOrThrow(['_outer', '_inner']);
    const field = driver.findOrThrow(['_outer', '_inner', '_inner_f']);
    const path = ['_outer', '_inner', '_inner_f'];

    for (const o of [0, 1]) {
      driver.handlerContext.setCurrentIndex(outer, o);
      for (const i of [0, 1]) {
        driver.handlerContext.setCurrentIndex(inner, i);
        driver.handlerContext.changeValue(field, `o${o}i${i}`);
      }
    }

    for (const o of [0, 1]) {
      driver.handlerContext.setCurrentIndex(outer, o);
      for (const i of [0, 1]) {
        driver.handlerContext.setCurrentIndex(inner, i);
        const node: any = driver.handlerContext.getDataObjectNodeByPath(path);
        expect(node['@value'], `coordinate o${o}i${i} collided`).toBe(`o${o}i${i}`);
      }
    }
    driver.expectNoErrors('deep writes');
  });

  it('adding an outer instance does not disturb existing inner values', () => {
    const driver = new CeeDriver(deepTemplate());
    const outer = driver.findOrThrow(['_outer']);
    const field = driver.findOrThrow(['_outer', '_inner', '_inner_f']);

    driver.handlerContext.setCurrentIndex(outer, 0);
    driver.handlerContext.changeValue(field, 'original');

    driver.handlerContext.addMultiInstance(outer);

    driver.handlerContext.setCurrentIndex(outer, 0);
    const node: any = driver.handlerContext.getDataObjectNodeByPath(['_outer', '_inner', '_inner_f']);
    expect(node['@value']).toBe('original');
    driver.expectNoErrors('add outer');
  });
});

describe('multi fields, every kind that supports it', () => {
  const multiCapable = FIELD_KINDS.filter((k) => !k.isStatic && supportsMultiInstance(k));

  it('is a non-trivial set', () => {
    expect(multiCapable.length).toBeGreaterThan(5);
  });

  it.each(multiCapable.map((k) => [k.key, k] as const))(
    '%s as a multi field inside a multi element keeps values per outer page',
    (_key, k) => {
      const driver = new CeeDriver(
        buildTemplate({
          name: `mm_${k.key}`,
          elements: [
            {
              name: 'el',
              cardinality: 'multi',
              minItems: 2,
              children: [{ kind: k, name: 'f', cardinality: 'multi', minItems: 1 }],
            },
          ],
        }),
      );
      const el = driver.findOrThrow(['_el']);

      driver.handlerContext.setCurrentIndex(el, 0);
      driver.setValue(['_el', '_f'], k);
      driver.expectNoErrors(`${k.key} multi-in-multi`);

      // Page 1 was never written; its slot must still be empty.
      driver.handlerContext.setCurrentIndex(el, 1);
      const node: any = driver.handlerContext.getDataObjectNodeByPath(['_el', '_f']);
      const one = Array.isArray(node) ? node[0] : node;
      const written = one?.['@value'] ?? one?.['@id'] ?? one?.['rdfs:label'];
      expect(written ?? null, `${k.key} leaked page 0's value into page 1`).toBeNull();
    },
  );
});
