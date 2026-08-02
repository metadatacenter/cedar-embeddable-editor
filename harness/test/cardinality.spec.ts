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

  it.each(requirable.map((k) => [k.key, k] as const))('%s counts once when required and single', (_key, k) => {
    const driver = new CeeDriver(
      buildTemplate({ name: `req_${k.key}`, children: [{ kind: k, name: 'f', required: true }] }),
    );
    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(0);
  });

  it.each(requirable.map((k) => [k.key, k] as const))('%s satisfies its requirement once filled', (_key, k) => {
    const driver = new CeeDriver(
      buildTemplate({ name: `reqf_${k.key}`, children: [{ kind: k, name: 'f', required: true }] }),
    );
    driver.setValue(['_f'], k);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount, `${k.key} did not register as filled`).toBe(1);
    expect(driver.qualityReport.isValid).toBe(true);
  });

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
 * How the quality report reads a stored value back out.
 *
 * `extractPlainValue` is the single place that turns an instance node into the
 * scalar the report reasons about, and it has three branches: `@value`, a bare
 * `@id`, and an `@id` paired with `rdfs:label`. Getting the branch wrong does
 * not error — it silently yields null and the field reads as empty.
 */
describe('quality report value extraction', () => {
  /**
   * REGRESSION: a filled required IRI-valued field satisfies its requirement.
   *
   * This was a defect, characterized here across all seven affected types
   * before being fixed. `changeValue` stores these as `{'@id': <iri>}` with no
   * `@value`, and `extractPlainValue` used to return the IRI only for
   * `InputType.link` — so every other IRI-valued type fell through to the
   * controlled-term branch, read an absent `rdfs:label`, and counted as empty.
   * A form with a required ORCID could never report valid.
   *
   * The fix has `extractPlainValue` consult `EXTERNAL_AUTHORITY_INPUT_TYPES`,
   * the set `DataObjectUtil.getEmptyValueWrapper` already used to decide these
   * fields get no `@value` in the first place — so the quality report and the
   * instance builder now agree about which fields carry an IRI, rather than
   * each having its own idea.
   *
   * Kept as an explicit table rather than folded into the generic
   * "satisfies its requirement once filled" sweep: this is the specific
   * regression, and it should fail loudly and by name if the set is ever
   * bypassed again.
   */
  it.each([
    ['ext-orcid', 'orcid'],
    ['ext-ror', 'ror'],
    ['ext-pfas', 'pfas'],
    ['ext-pubmed', 'pubmed'],
    ['ext-rrid', 'rrid'],
    ['ext-nih-grant-id', 'nihGrant'],
    ['ext-doi', 'doi'],
  ])('%s: a filled required field is seen by the quality report', (inputType, key) => {
    const k = FIELD_KINDS.find((x) => x.key === key)!;
    expect(k.inputType).toBe(inputType);

    const driver = new CeeDriver(
      buildTemplate({ name: `iri_${key}`, children: [{ kind: k, name: 'f', required: true }] }),
    );

    // Empty to begin with.
    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(0);
    expect(driver.qualityReport.isValid).toBe(false);

    driver.setValue(['_f'], k);

    // The IRI is stored as @id, with no @value...
    const node: any = driver.handlerContext.getDataObjectNodeByPath(['_f']);
    expect(node['@id']).toBe(k.sample);
    expect(node['@value']).toBeUndefined();

    // ...and the report now reads it.
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.isValid).toBe(true);
  });

  it('still reads a controlled term from its label, not its IRI', () => {
    // The other side of the same branch: controlled terms carry both @id and
    // rdfs:label, and the label is the value. Widening the IRI test must not
    // have swallowed this case.
    const controlled = FIELD_KINDS.find((k) => k.inputType === 'controlled')!;
    const driver = new CeeDriver(
      buildTemplate({ name: 'iri_controlled', children: [{ kind: controlled, name: 'f', required: true }] }),
    );
    driver.setValue(['_f'], controlled);

    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.isValid).toBe(true);
  });
});

/**
 * Behaviour that looks wrong, pinned so a fix is a deliberate, visible change.
 *
 * A characterization test: it asserts what CEE *does*, not what it arguably
 * should do. If someone fixes this, the test fails and they update it on
 * purpose — which is the point.
 */
describe('known defects (characterized, not endorsed)', () => {
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
