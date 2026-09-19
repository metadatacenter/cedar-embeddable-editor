import { describe, expect, it } from 'vitest';
import { CARDINALITIES, FIELD_KINDS, POPULATION_NESTINGS } from '../src/axes';
import { sweep } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { validateWithRawSchema } from '../src/instance-conformance';

const cases = sweep(FIELD_KINDS.filter((kind) => !kind.isStatic), CARDINALITIES, POPULATION_NESTINGS, {
  multiElementMinItems: 2,
  multiFieldMinItems: 0,
});

// Older instances can omit unfilled fields. Test their actual load/save path,
// independently validating output against the raw schema, not the parsed model.
describe('saving instances with omitted fields', () => {
  it.each(cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const original = new CeeDriver(c.template).emitted;
    const sparse = structuredClone(original);
    const omit = (node: any, path: string[]): void => {
      if (Array.isArray(node)) {
        node.forEach((entry) => omit(entry, path));
      } else if (path.length === 1) {
        delete node[path[0]];
      } else {
        omit(node[path[0]], path.slice(1));
      }
    };
    omit(sparse, c.path);
    const emitted = new CeeDriver(c.template, { instance: sparse }).emitted;
    const result = validateWithRawSchema(c.template, emitted);
    expect(result.count, result.detail).toBe(0);
    // A second load/save must preserve the repaired document exactly.
    expect(new CeeDriver(c.template, { instance: emitted }).emitted).toEqual(emitted);
  });
});
