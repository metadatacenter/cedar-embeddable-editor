/**
 * The empty instance a template produces before anyone types anything.
 *
 * `DataObjectBuilderHandler` walks the component tree and, for each field,
 * writes the slot its value will go in — which is not the same shape for every
 * field type. A literal gets `{'@value': null}`, an IRI-valued field gets `{}`
 * because there is no `@value` to be null, a numeric or temporal field gets an
 * `@type` alongside, and a choice field with a default selection is not empty
 * at all. It does this twice, once with `@context` and `@id` for the copy the
 * host page gets back and once without for the copy CEE works against.
 *
 * The shapes are pinned here per field type and per building mode. Nothing
 * asserted them directly before: the round-trip suite writes a value and reads
 * it back, so it exercises the slot without ever saying what an *unwritten*
 * slot should look like — and "what does an empty form serialise to" is the
 * question a host page asks first.
 *
 * They exist to be diffed. The builder currently answers all of this by
 * re-reading the raw template JSON in parallel with the component tree it is
 * already walking, and that second walk is what should go.
 */
import { describe, expect, it } from 'vitest';
import { DocumentKey } from '../src/document-keys';
import { CedarBuilders, NumberType, TemporalType } from 'cedar-model-typescript-library';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { labelOf, xsdTypeOf, heldValue } from '../src/values';

/** Every field type that takes a value; static content has no slot. */
const VALUED = FIELD_KINDS.filter((k) => !k.isStatic);

/** `@id`s are minted per run, so normalise them out of any comparison. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stable = (node: any): any => {
  if (Array.isArray(node)) return node.map(stable);
  if (node && typeof node === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = {};
    for (const key of Object.keys(node)) {
      out[key] = key === DocumentKey.atId && typeof node[key] === 'string' ? '<minted>' : stable(node[key]);
    }
    return out;
  }
  return node;
};

describe('the slot a single field starts with', () => {
  it.each(VALUED.map((k) => [k.key, k] as const))('%s', (key, fieldKind) => {
    const driver = new CeeDriver(buildTemplate({ name: `sk_${key}`, children: [{ kind: fieldKind, name: 'f' }] }));
    expect({
      holds: heldValue(driver.extract.values._f),
      written: stable(driver.metadata._f),
    }).toMatchSnapshot();
  });
});

describe('the slot a multi field starts with', () => {
  it.each(VALUED.map((k) => [k.key, k] as const))('%s', (key, fieldKind) => {
    const driver = new CeeDriver(
      buildTemplate({
        name: `skm_${key}`,
        children: [{ kind: fieldKind, name: 'f', cardinality: 'multi', minItems: 2, maxItems: 9 }],
      }),
    );
    expect({
      holds: heldValue(driver.extract.values._f),
      written: stable(driver.metadata._f),
    }).toMatchSnapshot();
  });
});

describe('the shape of an element', () => {
  /**
   * A single element is one object carrying a minted `@id`; a multi element is
   * a list of `minItems` of them, each with its own. The `@id` only appears in
   * the full copy — the extract form drops it, which is why the reader had to
   * stop relying on `@context` to recognise an element.
   *
   * That last sentence was in this comment before it was true. The snapshot
   * below recorded an `@id` in the extract for months, because the builder
   * minted one into whichever tree it was filling, and a snapshot records
   * whatever happens rather than whatever was meant. `tree-consistency.spec.ts`
   * now asserts the property directly, in both directions, instead of leaving it
   * to a comment and a recording that disagreed.
   */
  it('a single element', () => {
    const template = buildTemplate({
      name: 'sk_el',
      elements: [{ name: 'el', children: [{ kind: VALUED[0], name: 'f' }] }],
    });
    const driver = new CeeDriver(template);
    expect({ holds: heldValue(driver.extract.values._el), written: stable(driver.metadata._el) }).toMatchSnapshot();
  });

  it('a multi element starts at minItems', () => {
    const template = buildTemplate({
      name: 'sk_el_multi',
      elements: [
        { name: 'el', cardinality: 'multi', minItems: 3, maxItems: 9, children: [{ kind: VALUED[0], name: 'f' }] },
      ],
    });
    const driver = new CeeDriver(template);
    expect(driver.extract.values._el).toHaveLength(3);
    expect(stable(driver.metadata._el)).toMatchSnapshot();
  });

  it('a multi element with no floor starts empty', () => {
    const template = buildTemplate({
      name: 'sk_el_zero',
      elements: [
        { name: 'el', cardinality: 'multi', minItems: 0, maxItems: 9, children: [{ kind: VALUED[0], name: 'f' }] },
      ],
    });
    expect(new CeeDriver(template).extract.values._el).toEqual([]);
  });

  it('gives every occurrence of a multi element its own @id', () => {
    const template = buildTemplate({
      name: 'sk_el_ids',
      elements: [
        { name: 'el', cardinality: 'multi', minItems: 3, maxItems: 9, children: [{ kind: VALUED[0], name: 'f' }] },
      ],
    });
    const ids = new CeeDriver(template).metadata._el.map((o: Record<string, string>) => o[DocumentKey.atId]);
    expect(new Set(ids).size, `occurrences share an @id: ${ids.join(', ')}`).toBe(3);
  });
});

describe('the XSD type a numeric or temporal slot declares', () => {
  /**
   * A numeric or temporal value carries its type alongside itself in the full
   * copy, so a consumer can read `7` as an integer rather than a string.
   *
   * REGRESSION: the type used to be dug out of the raw template's
   * `_valueConstraints`, and the test was whether the *key* was there rather
   * than whether it had a value. Every real template declares one — all 339
   * numeric and 78 temporal fields across the shared corpora do — but a
   * template that leaves it null has the key, so `"@type": null` went into
   * every instance the form produced. That is not a type, and it is not valid
   * JSON-LD.
   *
   * The parsed component answers instead. It has the declared type where there
   * is one, the model's default of `xsd:decimal` for a numeric field without
   * one, and nothing for a temporal field without one — so the key is simply
   * absent rather than present and null.
   */
  const numeric = (numberType?: string) => {
    const kind = {
      key: 'num',
      inputType: 'numeric',
      make: () => CedarBuilders.numericFieldBuilder(),
      isStatic: false,
      write: 'value' as const,
      sample: '1',
      configure: numberType
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (b: unknown) => (b as any).withNumberType(NumberType.forValue(numberType))
        : undefined,
    };
    const template = buildTemplate({ name: `sk_num_${numberType ?? 'none'}`, children: [{ kind, name: 'f' }] });
    return new CeeDriver(template).metadata._f;
  };

  it('uses the declared numeric type', () => {
    expect(xsdTypeOf(numeric('xsd:int'))).toBe('xsd:int');
  });

  /**
   * A template that declares nothing gets the model's default rather than a
   * null: a numeric field without a declared type is a decimal.
   */
  it('never writes a null type', () => {
    const slot = numeric();
    expect(xsdTypeOf(slot), 'a null @type was written into the instance').not.toBeNull();
    expect(xsdTypeOf(slot)).toBe('xsd:decimal');
  });

  it('leaves the type off a temporal field that declares none', () => {
    const kind = {
      key: 'tmp',
      inputType: 'temporal',
      make: () => CedarBuilders.temporalFieldBuilder(),
      isStatic: false,
      write: 'value' as const,
      sample: '2026-01-01',
    };
    const template = buildTemplate({ name: 'sk_tmp_none', children: [{ kind, name: 'f' }] });
    const slot = new CeeDriver(template).metadata._f;
    expect(Object.hasOwn(slot, DocumentKey.atType), 'a null @type was written into the instance').toBe(false);
  });

  it('uses the declared temporal type', () => {
    const kind = {
      key: 'tmp2',
      inputType: 'temporal',
      make: () => CedarBuilders.temporalFieldBuilder(),
      isStatic: false,
      write: 'value' as const,
      sample: '2026-01-01',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configure: (b: unknown) => (b as any).withTemporalType(TemporalType.DATE),
    };
    const template = buildTemplate({ name: 'sk_tmp_date', children: [{ kind, name: 'f' }] });
    expect(xsdTypeOf(new CeeDriver(template).emitted._f)).toBe('xsd:date');
  });
});

describe('the @context the full copy carries', () => {
  /**
   * Copied from the template's own `properties/@context/properties`, entry by
   * entry: the standard prefixes as strings, the typed entries as
   * `{'@type': …}`, and one IRI per child. Copied rather than regenerated, so a
   * template declaring something unusual keeps it.
   */
  it('carries the standard prefixes and one IRI per child', () => {
    const template = buildTemplate({
      name: 'sk_ctx',
      children: [
        { kind: VALUED[0], name: 'a' },
        { kind: VALUED[0], name: 'b' },
      ],
    });
    const context = new CeeDriver(template).metadata[DocumentKey.atContext];

    expect(context.rdfs).toBe('http://www.w3.org/2000/01/rdf-schema#');
    expect(context.xsd).toBe('http://www.w3.org/2001/XMLSchema#');
    expect(context[DocumentKey.rdfsLabel], 'the @context declares rdfs:label as a typed property').toEqual({
      [DocumentKey.atType]: 'xsd:string',
    });
    expect(context[DocumentKey.pavCreatedOn]).toEqual({ [DocumentKey.atType]: 'xsd:dateTime' });
    expect(typeof context._a).toBe('string');
    expect(typeof context._b).toBe('string');
    expect(context._a).not.toBe(context._b);
  });

  /**
   * The property IRIs travel with the data now.
   *
   * This asserted their absence, because CEE built the extract by walking the
   * full document and deleting envelope keys, and `@context` was one of them.
   * The extract is what the library writes for an instance's data, and a
   * container's property IRIs are part of that — what it leaves off is the
   * envelope proper: the instance's own IRI, its name and description, and the
   * four provenance fields.
   */
  it('carries the property IRIs, and none of the envelope', () => {
    const template = buildTemplate({ name: 'sk_ctx_x', children: [{ kind: VALUED[0], name: 'a' }] });
    const extract = new CeeDriver(template).extract;
    expect(Object.keys(extract.iris)).toEqual(['_a']);
    // The envelope is not on the container at all — it is the instance's, and the
    // container holds only what the fields hold.
    expect(Object.keys(extract.values)).toEqual(['_a']);
  });

  it('gives a nested element its own @context', () => {
    const template = buildTemplate({
      name: 'sk_ctx_el',
      elements: [{ name: 'el', children: [{ kind: VALUED[0], name: 'f' }] }],
    });
    const context = new CeeDriver(template).metadata._el[DocumentKey.atContext];
    expect(typeof context._f).toBe('string');
  });
});
