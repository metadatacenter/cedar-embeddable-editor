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
import { InstanceValueNode } from '@cee/util/instance-value-node';
import { infoOf } from '../src/nodes';
import { containerValue as occurrenceValue, instanceWith, labelOf, listValue, literalOf, heldValue } from '../src/values';
import { JsonSchema } from 'cedar-model-typescript-library';

/**
 * An instance always names the template it is an instance of; there is no
 * valid CEDAR instance without one. Fixtures that stand in for what a host page
 * injects have to be valid instances too.
 */
const TEMPLATE_IRI = 'https://repo.metadatacenter.org/templates/fixture';
const INSTANCE_IRI = 'https://example.org/i/1';
const SECOND_INSTANCE_IRI = 'https://example.org/i/2';

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;
const TEXT = kind('textfield');

const countOf = (d: CeeDriver, c: any) =>
  infoOf(d.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(c), c).currentCount;

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
   * That is the "at least one instance must carry a value" semantic, now made
   * deliberate: see "required values are page-independent" below, which pins
   * that the *which* instance no longer matters either.
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

    // An IRI-valued field holds an IRI and no literal...
    const node: any = driver.handlerContext.getDataObjectNodeByPath(['_f']);
    expect(heldValue(node)).toEqual({ iri: k.sample });
    expect(InstanceValueNode.literal(node)).toBeUndefined();

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
 * REGRESSION: validity does not depend on which page is on screen.
 *
 * `buildRecursively` evaluates a multi element's children once against
 * whichever instance `currentIndex` points at, then clones the result. Asking
 * `getDataObjectNodeByPath` whether a required field is filled therefore
 * answered only for the visible page: the same instance reported valid or
 * invalid depending on where the user had paged to.
 *
 * The report now decides satisfaction with `findAnyValue`, a cursor-free walk
 * of the extract instance that branches into every array entry. Semantics are
 * **at least one**: a requirement on a field inside a repeated element is met
 * when any instance carries a value.
 *
 * The value *tree* still shows the displayed page — that is a snapshot of what
 * is on screen, and it is only the counters that should be page-independent.
 */
describe('required values are page-independent', () => {
  const threeInstances = () =>
    buildTemplate({
      name: 'pages',
      elements: [
        { name: 'el', cardinality: 'multi', minItems: 3, children: [{ kind: TEXT, name: 'f', required: true }] },
      ],
    });

  /** Fill exactly one page, then read validity from each page in turn. */
  const validityFromEachPage = (filledPage: number) => {
    const driver = new CeeDriver(threeInstances());
    const el = driver.findOrThrow(['_el']);

    driver.handlerContext.setCurrentIndex(el, filledPage);
    driver.setValue(['_el', '_f'], TEXT, `filled on page ${filledPage}`);

    return [0, 1, 2].map((page) => {
      driver.handlerContext.setCurrentIndex(el, page);
      driver.handlerContext.buildQualityReport();
      return driver.qualityReport.isValid;
    });
  };

  it.each([0, 1, 2])('a value on page %i satisfies the requirement from every page', (filledPage) => {
    expect(validityFromEachPage(filledPage)).toEqual([true, true, true]);
  });

  it('is invalid from every page when no instance carries a value', () => {
    const driver = new CeeDriver(threeInstances());
    const el = driver.findOrThrow(['_el']);

    for (const page of [0, 1, 2]) {
      driver.handlerContext.setCurrentIndex(el, page);
      driver.handlerContext.buildQualityReport();
      expect(driver.qualityReport.isValid, `page ${page}`).toBe(false);
    }
  });

  it('becomes invalid again when the only value is cleared', () => {
    const driver = new CeeDriver(threeInstances());
    const el = driver.findOrThrow(['_el']);

    driver.handlerContext.setCurrentIndex(el, 1);
    driver.setValue(['_el', '_f'], TEXT, 'temporary');
    expect(driver.qualityReport.isValid).toBe(true);

    driver.setValue(['_el', '_f'], TEXT, '');
    expect(driver.qualityReport.isValid).toBe(false);
  });

  /**
   * The value tree is a view of the current page and must stay that way — the
   * fix separates "what is displayed" from "what satisfies the requirement",
   * and conflating them again would show a value from another instance.
   */
  it('still reports the displayed page in the value tree', () => {
    const driver = new CeeDriver(threeInstances());
    const el = driver.findOrThrow(['_el']);

    driver.handlerContext.setCurrentIndex(el, 2);
    driver.setValue(['_el', '_f'], TEXT, 'only page two');

    driver.handlerContext.setCurrentIndex(el, 0);
    driver.handlerContext.buildQualityReport();

    const node: any = driver.handlerContext.getDataObjectNodeByPath(['_el', '_f']);
    expect(literalOf(node) ?? null, 'page 0 is genuinely empty').toBeNull();
    expect(driver.qualityReport.isValid, 'but the instance as a whole satisfies it').toBe(true);
  });

  /**
   * A partial instance, which CEE itself never builds but a host page can inject:
   * an occurrence that is there and holds nothing.
   *
   * `findAnyValue` guards against a missing node, and that guard is unreachable
   * from an instance CEE constructed — it writes an empty value rather than
   * leaving the property out — so without this case the guard is untested and a
   * mutation making it return a value survives silently.
   *
   * The companion case held a null where the field belongs. That is an invalid
   * artifact, so the library refuses to build one and the question of what the
   * reader makes of it is the library's, not this suite's.
   */
  it('is invalid when an entry omits the field', () => {
    const instance: any = { ...instanceWith(TEMPLATE_IRI, {}, INSTANCE_IRI), _el: [occurrenceValue({})] };

    const driver = new CeeDriver(threeInstances(), { instance });
    driver.handlerContext.buildQualityReport();

    expect(driver.qualityReport.requiredFieldValueCount).toBeGreaterThan(0);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(0);
    expect(driver.qualityReport.isValid).toBe(false);
  });

  /**
   * BEHAVIOUR CHANGE, and a consistency fix.
   *
   * An element that is *absent* and one whose array is *empty* say the same thing
   * — there are no occurrences — and used to be reported differently. `absent`
   * counted three unfilled required fields, because the count came from the
   * template's `minItems` rather than from the document; `empty` counted none.
   *
   * `currentCount` now reads the instance, so both say none, and both are invalid
   * for the reason that is actually true: a `minItems` violation. Which is the
   * more precise complaint — the problem is not that a required field is
   * unfilled, it is that the element is not there — and it is the same reasoning
   * the test below already applied to the zero-instances case.
   */
  it.each([
    ['the array is absent', undefined],
    ['the array is empty', []],
  ])('reports a minItems violation, not phantom required fields, when %s', (_label, elValue) => {
    const instance: any = instanceWith(TEMPLATE_IRI, {}, INSTANCE_IRI);
    if (elValue !== undefined) {
      instance._el = elValue;
    }

    const driver = new CeeDriver(threeInstances(), { instance });
    driver.handlerContext.buildQualityReport();

    expect(driver.qualityReport.isValid, 'still invalid').toBe(false);
    expect(driver.qualityReport.problems.map((p: any) => p.code)).toContain('minItems');
    expect(driver.qualityReport.requiredFieldValueCount, 'no occurrences means no required fields to count').toBe(0);
  });

  /**
   * BEHAVIOUR CHANGE. This used to assert the two were reported *identically*.
   *
   * They agree on everything that decides the outcome — both invalid, both for a
   * `minItems` violation, both counting no required fields — and that is what the
   * previous assertion was protecting. But an absent property and an empty array
   * are not the same document, and the canonical validator does not treat them as
   * such. Run against `multiple-element-items-template.json` with
   * `ops/cedar_validate.sh instance`:
   *
   *   element `[]`      -> `/Participant: must have at least 1 items but found 0`
   *   element omitted   -> `object has missing required properties (['Participant'])`
   *
   * So `missingProperty` on the absent one is the arbiter's own distinction, not a
   * regression in ours. Collapsing it was hiding information the gate reports.
   */
  it('an absent element and an empty one agree on the verdict but not on the reason', () => {
    const report = (elValue: unknown) => {
      const instance: any = instanceWith(TEMPLATE_IRI, {}, INSTANCE_IRI);
      if (elValue !== undefined) {
        instance._el = elValue;
      }
      const driver = new CeeDriver(threeInstances(), { instance });
      driver.handlerContext.buildQualityReport();
      const r = driver.qualityReport;
      return {
        valid: r.isValid,
        required: r.requiredFieldValueCount,
        codes: r.problems.map((p: any) => p.code).sort(),
      };
    };

    const absent = report(undefined);
    const empty = report([]);

    // The verdict and the counts, which is what callers act on.
    expect(absent.valid).toBe(empty.valid);
    expect(absent.valid).toBe(false);
    expect(absent.required).toBe(empty.required);

    // The reasons, which is where they legitimately differ.
    expect(empty.codes).toEqual(['minItems']);
    expect(absent.codes).toEqual(['minItems', 'missingProperty']);
  });

  /**
   * An element with zero instances used to report vacuously valid: the
   * multi-element branch is guarded by `multiCount > 0`, so no requirement was
   * counted, and `0 <= 0` passed. Whether that should be valid was left as an
   * open product question.
   *
   * Cardinality checking answers it without needing the question settled
   * separately. `minItems: 3` with zero instances is a `minItems` violation,
   * which is the more precise complaint anyway — the problem is not that a
   * required field is unfilled, it is that the element is not there.
   */
  it('reports a minItems violation when the element has no instances', () => {
    const driver = new CeeDriver(threeInstances(), {
      instance: instanceWith(TEMPLATE_IRI, { _el: listValue() }, INSTANCE_IRI),
    });
    driver.handlerContext.buildQualityReport();

    // Still no *required-value* requirement, since no instance exists to hold one.
    expect(driver.qualityReport.requiredFieldValueCount).toBe(0);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(0);
    // But the cardinality floor is violated, so the instance is not valid.
    expect(driver.qualityReport.problems.map((p: any) => p.code)).toContain('minItems');
    expect(driver.qualityReport.isValid).toBe(false);
  });

  /**
   * BEHAVIOUR CHANGE, and the last case where CEE and the arbiter disagreed.
   *
   * This used to assert *vacuously valid*: with no `minItems` there was no floor
   * to violate, the cardinality check returned early, and an element that was not
   * there at all reported clean. Reasonable on its own terms, and wrong — CEDAR
   * lists a multi child in its parent's JSON Schema `required` array independently
   * of any floor, so the property has to be present whatever the floor says, and
   * an array is the only shape that satisfies it.
   *
   * Settled by **running `cedar-model-validation-library`** rather than reading the
   * schema — `ops/cedar_validate.sh instance`, with `minItems` stripped from
   * `multiple-element-items-template.json`:
   *
   *   element `[]`      -> valid
   *   element omitted   -> `object has missing required properties`
   *   element `null`     -> `null found, array expected`
   *
   * Both halves are tested below, because a presence check that fires on `[]`
   * would be a new divergence in the opposite direction — and the empty array is
   * the case a zero-floor template exists to allow.
   *
   * `minItems` has to be stripped by hand because the model library always writes
   * one for a multi child. That is also why this was never an outage: across the
   * corpus, HuBMAP and the validator's own fixtures there are 321 multi children
   * and every one declares a floor.
   */
  const noFloorTemplate = () => {
    const t: any = buildTemplate({
      name: 'no_floor',
      elements: [{ name: 'el', cardinality: 'multi', children: [{ kind: TEXT, name: 'f', required: true }] }],
    });
    delete t.properties._el.minItems;
    return t;
  };

  /**
   * Only the absent case. Its companion put a null where the list belongs, which
   * is an invalid artifact the library will not build.
   */
  it('is invalid when no minItems is declared and the element is absent', () => {
    const instance: any = instanceWith(TEMPLATE_IRI, {}, SECOND_INSTANCE_IRI);

    const driver = new CeeDriver(noFloorTemplate(), { instance });
    driver.handlerContext.buildQualityReport();

    expect(driver.qualityReport.problems.map((p: any) => p.code)).toContain('missingProperty');
    expect(driver.qualityReport.isValid, 'the gate rejects this, so we must too').toBe(false);
    // Not a `minItems` complaint: there is no floor to violate. The property is
    // simply not there, which is a different thing and a different code.
    expect(driver.qualityReport.problems.map((p: any) => p.code)).not.toContain('minItems');
  });

  it('is valid when no minItems is declared and the element is an empty array', () => {
    const driver = new CeeDriver(noFloorTemplate(), {
      instance: instanceWith(TEMPLATE_IRI, { _el: [] }, 'https://example.org/i/2'),
    });
    driver.handlerContext.buildQualityReport();

    expect(driver.qualityReport.problems).toEqual([]);
    expect(driver.qualityReport.isValid, 'an empty array satisfies a zero floor').toBe(true);
  });

  it('holds for a deeply nested required field', () => {
    const deep = buildTemplate({
      name: 'pages_deep',
      elements: [
        {
          name: 'outer',
          cardinality: 'multi',
          minItems: 2,
          children: [],
          elements: [
            {
              name: 'inner',
              cardinality: 'multi',
              minItems: 2,
              children: [{ kind: TEXT, name: 'f', required: true }],
            },
          ],
        },
      ],
    });
    const driver = new CeeDriver(deep);
    const outer = driver.findOrThrow(['_outer']);
    const inner = driver.findOrThrow(['_outer', '_inner']);

    // Fill the last coordinate only.
    driver.handlerContext.setCurrentIndex(outer, 1);
    driver.handlerContext.setCurrentIndex(inner, 1);
    driver.setValue(['_outer', '_inner', '_f'], TEXT, 'deep value');

    // Read from the first coordinate.
    driver.handlerContext.setCurrentIndex(outer, 0);
    driver.handlerContext.setCurrentIndex(inner, 0);
    driver.handlerContext.buildQualityReport();

    expect(driver.qualityReport.isValid).toBe(true);
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
        expect(heldValue(node), `coordinate o${o}i${i} collided`).toBe(`o${o}i${i}`);
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
    expect(heldValue(node)).toBe('original');
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
      const written = literalOf(one) ?? one?.[JsonSchema.atId] ?? labelOf(one);
      expect(written ?? null, `${k.key} leaked page 0's value into page 1`).toBeNull();
    },
  );
});
