/**
 * Coverage / drift detection.
 *
 * These tests do not exercise behaviour — they assert that the generator keeps
 * up with CEE. When someone adds an input type to `InputType` (as `develop`
 * just did, five times over), this suite fails until either a builder exists
 * for it or it is explicitly acknowledged in UNCOVERED_INPUT_TYPES.
 *
 * That is the difference between "we have tests" and "we know what our tests
 * cover".
 */
import { describe, expect, it } from 'vitest';
import { InputType } from '@cee/models/input-type.model';
import { FIELD_KINDS, UNCOVERED_INPUT_TYPES } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

/** Every `_ui.inputType` string CEE knows how to render. */
const allInputTypes = (): string[] => Object.values(InputType).filter((v): v is string => typeof v === 'string');

describe('input type coverage', () => {
  it('accounts for every InputType CEE declares', () => {
    const covered = new Set(FIELD_KINDS.map((k) => k.inputType));
    const acknowledged = new Set(UNCOVERED_INPUT_TYPES);

    const unaccounted = allInputTypes().filter((t) => !covered.has(t) && !acknowledged.has(t));

    expect(
      unaccounted,
      `CEE gained input type(s) with no generator coverage. Either add a builder to the ` +
        `model library and an entry to FIELD_KINDS, or add them to UNCOVERED_INPUT_TYPES ` +
        `with a note explaining why.`,
    ).toEqual([]);
  });

  it('has no stale entries in UNCOVERED_INPUT_TYPES', () => {
    const known = new Set(allInputTypes());
    const stale = UNCOVERED_INPUT_TYPES.filter((t) => !known.has(t));
    expect(stale, 'UNCOVERED_INPUT_TYPES names types CEE no longer has').toEqual([]);
  });

  it('does not list a type as uncovered when a builder now exists', () => {
    const covered = new Set(FIELD_KINDS.map((k) => k.inputType));
    const nowCovered = UNCOVERED_INPUT_TYPES.filter((t) => covered.has(t));
    expect(nowCovered, 'These are covered now — remove them from UNCOVERED_INPUT_TYPES').toEqual([]);
  });

  it('reports the current coverage ratio', () => {
    const total = allInputTypes().length;
    const covered = new Set(FIELD_KINDS.map((k) => k.inputType)).size;
    // Informational, but pinned: this should only ever move up.
    // 19/24 when the harness was written; 20/24 since ext-pfas was wired into
    // the model library's builder facade.
    expect(covered / total).toBeGreaterThanOrEqual(20 / 24);
  });
});

describe('generator fidelity', () => {
  /**
   * The generator is only useful if CEE reads back the input type we asked the
   * library to produce. This catches vocabulary drift between the two repos —
   * e.g. the library renaming a `_ui.inputType` value CEE still matches on.
   */
  it.each(FIELD_KINDS.map((k) => [k.key, k] as const))(
    'template built for %s parses in CEE with the expected inputType',
    (_key, kind) => {
      const template = buildTemplate({
        name: `fidelity_${kind.key}`,
        children: [{ kind, name: kind.key }],
      });
      const driver = new CeeDriver(template);
      const component = driver.findOrThrow([`_${kind.key}`]);

      expect(component.basicInfo.inputType).toBe(kind.inputType);
      driver.expectNoErrors(`parsing ${kind.key}`);
    },
  );

  /**
   * Controlled-term constraints override the declared input type in
   * `TemplateRepresentationFactory.extractValueConstraints` — a field declared
   * as `textfield` renders as `controlled` if it carries any ontology, value
   * set, class, or branch. Worth pinning: it is silent, and it is the one place
   * the rendered type diverges from what the template says.
   */
  it('lets controlled-term constraints win over the declared input type', () => {
    const controlled = FIELD_KINDS.find((k) => k.inputType === 'controlled')!;
    const template = buildTemplate({
      name: 'controlled_override',
      children: [{ kind: controlled, name: 'term' }],
    });
    const driver = new CeeDriver(template);
    expect(driver.findOrThrow(['_term']).basicInfo.inputType).toBe('controlled');
  });
});
