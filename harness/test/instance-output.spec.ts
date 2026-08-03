/**
 * What a host page gets back, and in what format.
 *
 * CEE used to hand over the tree it had been mutating — a pile of plain objects
 * it had assembled key by key, which happened to be shaped like CEDAR JSON
 * because CEE had built it that way. The tree is still CEE's working copy and
 * still plain objects, which is fine: the widgets hold references into it and
 * mutate it in place, and its shape is nobody else's business.
 *
 * What leaves is another matter. An instance a host saves is a CEDAR artifact,
 * and what one of those looks like belongs to the model. So the working tree is
 * read into the library's `TemplateInstance` on the way out and the library
 * writes it — which makes YAML a different writer rather than a different code
 * path.
 *
 * Two things need holding down. The values have to survive the round trip
 * exactly, for every field type and every corpus instance. And the difference
 * that is *not* nothing — the library writes a complete instance envelope where
 * CEE wrote none — has to be stated rather than discovered.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { CARDINALITIES, FIELD_KINDS } from '../src/axes';
import { corpusAvailable, corpusTemplates } from '../src/corpus';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

const VALUED = FIELD_KINDS.filter((k) => !k.isStatic);

/**
 * The envelope keys the *writer* supplies, as against the ones CEE fills in.
 *
 * A template's `required` list names nine keys its instances must carry. CEE
 * sets three of them, because it knows them: `schema:isBasedOn` from the
 * template's IRI, and `schema:name` and `schema:description`, whose schemas are
 * `string` — `minLength: 1` in the first case — so null would not validate.
 *
 * These five it cannot know. `@id` and the provenance fields are assigned when
 * the instance is saved, and their schemas are `["string", "null"]`, so null is
 * both honest and valid. The writer emits them so the document is complete.
 */
const ENVELOPE_KEYS = ['@id', 'pav:createdOn', 'pav:createdBy', 'pav:lastUpdatedOn', 'oslc:modifiedBy'];

/** A one-field form with a value in it. */
const filled = (kindIndex: number, cardinality: 'single' | 'multi') => {
  const kind = VALUED[kindIndex];
  const driver = new CeeDriver(
    buildTemplate({
      name: `io_${kind.key}_${cardinality}`,
      children: [
        {
          kind,
          name: 'f',
          cardinality: cardinality === 'multi' ? 'multi' : undefined,
          minItems: cardinality === 'multi' ? 2 : undefined,
          maxItems: cardinality === 'multi' ? 5 : undefined,
        },
      ],
    }),
  );
  driver.setValue(['_f'], kind);
  return driver;
};

const cases = VALUED.flatMap((kind, i) => CARDINALITIES.map((c) => [`${kind.key}/${c}`, i, c] as const));

describe('the JSON a host page receives', () => {
  /**
   * The values are the point. Whatever the envelope does, every field's slot
   * has to come back exactly as CEE was holding it.
   */
  it.each(cases)('%s keeps its value', (_label, index, cardinality) => {
    const driver = filled(index, cardinality);
    const working = driver.dataContext.instanceFullData as Record<string, unknown>;
    const emitted = InstanceSerializer.toJson(driver.dataContext.instanceFullData) as Record<string, unknown>;
    expect(emitted._f).toEqual(working._f);
  });

  it.each(cases)('%s keeps its @context', (_label, index, cardinality) => {
    const driver = filled(index, cardinality);
    const working = driver.dataContext.instanceFullData as Record<string, unknown>;
    const emitted = InstanceSerializer.toJson(driver.dataContext.instanceFullData) as Record<string, unknown>;
    expect(emitted['@context']).toEqual(working['@context']);
  });

  /**
   * The writer completes the envelope with the keys CEE cannot fill in, and
   * adds nothing else. Whether the result actually validates as a CEDAR
   * instance is checked in `model-conformance.spec.ts`, against the template's
   * own schema; this only pins what the emission step contributes.
   */
  it('adds the envelope keys CEE cannot know, and nothing else', () => {
    const driver = filled(0, 'single');
    const working = driver.dataContext.instanceFullData as Record<string, unknown>;
    const emitted = InstanceSerializer.toJson(driver.dataContext.instanceFullData) as Record<string, unknown>;

    const added = Object.keys(emitted).filter((k) => !(k in working));
    expect(added.sort()).toEqual([...ENVELOPE_KEYS].sort());
    for (const key of added) {
      expect(emitted[key], `${key} should be null, not invented`).toBeNull();
    }
    expect(Object.keys(working).filter((k) => !(k in emitted)), 'the emitter dropped something').toEqual([]);
  });

  it('is empty for an instance that does not exist', () => {
    expect(InstanceSerializer.toJson(null as never)).toEqual({});
  });
});

describe('the instance says which template it is an instance of', () => {
  /**
   * `schema:isBasedOn` is the only link from an instance back to the thing that
   * defines it. Without it nothing downstream can validate the instance, render
   * it, or find its template again — the Java artifact library treats it as
   * mandatory, a non-optional URI checked when the artifact is constructed.
   *
   * CEE was not writing it at all. The TypeScript library models it and both its
   * writers emit it; CEE simply never put the template's IRI on the instance, so
   * every instance CEE produced was orphaned.
   */
  const withTemplateId = (atId: string | null) => {
    const template = buildTemplate({ name: 'io_based', children: [{ kind: VALUED[0], name: 'f' }] }) as Record<
      string,
      unknown
    >;
    if (atId === null) {
      delete template['@id'];
    } else {
      template['@id'] = atId;
    }
    return new CeeDriver(template);
  };

  it('names the template it came from', () => {
    const driver = withTemplateId('https://repo.metadatacenter.org/templates/abc');
    const emitted = InstanceSerializer.toJson(driver.dataContext.instanceFullData) as Record<string, unknown>;
    expect(emitted['schema:isBasedOn']).toBe('https://repo.metadatacenter.org/templates/abc');
  });

  it('reads it from whichever serialisation the template arrived in', () => {
    const driver = withTemplateId('https://repo.metadatacenter.org/templates/abc');
    expect((driver.dataContext.instanceFullData as Record<string, unknown>)['schema:isBasedOn']).toBe(
      'https://repo.metadatacenter.org/templates/abc',
    );
  });

  /**
   * A template with no IRI cannot produce a valid instance — there is no such
   * thing as a CEDAR instance that does not name its template. CEE says so when
   * it reads the template, rather than handing back a document nothing can
   * resolve and leaving it to be discovered later.
   *
   * Only `template-001` of the 94 in the shared corpora is in this state, and
   * its readme says why: it was never saved.
   */
  it('reports a template with no IRI rather than quietly orphaning its instances', () => {
    const driver = withTemplateId(null);
    expect(driver.messages.errors.join(' ')).toContain('no @id');
  });

  it('says nothing when the template has one', () => {
    const driver = withTemplateId('https://repo.metadatacenter.org/templates/abc');
    driver.expectNoErrors('parsing a template with an @id');
  });

  /**
   * Not on the working copy CEE edits against — that has no envelope at all,
   * and `deleteContext` strips this along with `@id` and the provenance.
   */
  it('is not on the extract copy', () => {
    const driver = withTemplateId('https://repo.metadatacenter.org/templates/abc');
    expect((driver.extract as Record<string, unknown>)['schema:isBasedOn']).toBeUndefined();
  });

  /**
   * REGRESSION SURFACE: an injected instance skips the builder, so setting this
   * only while building left every document a host page loaded orphaned — the
   * common case, and the one where the instance already exists and matters.
   */
  it('names the template on an instance the host page injected', () => {
    const template = buildTemplate({ name: 'io_injected', children: [{ kind: VALUED[0], name: 'f' }] }) as Record<
      string,
      unknown
    >;
    template['@id'] = 'https://repo.metadatacenter.org/templates/injected';
    const driver = new CeeDriver(template, {
      instance: { '@context': {}, '@id': 'https://example.org/i/9', _f: { '@value': 'loaded' } },
    });

    const emitted = InstanceSerializer.toJson(driver.dataContext.instanceFullData) as Record<string, unknown>;
    expect(emitted['schema:isBasedOn']).toBe('https://repo.metadatacenter.org/templates/injected');
  });

  it('survives into the YAML', () => {
    const driver = withTemplateId('https://repo.metadatacenter.org/templates/abc');
    expect(InstanceSerializer.toYaml(driver.dataContext.instanceFullData)).toContain(
      'https://repo.metadatacenter.org/templates/abc',
    );
  });
});

describe.skipIf(!corpusAvailable())('real instances survive the trip', () => {
  /**
   * The generated cases cover one field at a time. These are whole templates,
   * with elements nested several deep and every field type mixed together.
   */
  it.each(corpusTemplates().map((t) => [t.id, t] as const))('template-%s emits its values unchanged', (_id, artifact) => {
    const driver = new CeeDriver(artifact.json);
    const working = driver.dataContext.instanceFullData as Record<string, unknown>;
    const emitted = InstanceSerializer.toJson(driver.dataContext.instanceFullData) as Record<string, unknown>;

    for (const key of Object.keys(working)) {
      expect(emitted[key], `${key} changed on the way out`).toEqual(working[key]);
    }
  });
});

describe('the YAML a host page can ask for instead', () => {
  /**
   * The claim this is here to support: CEE does not write CEDAR JSON, it
   * produces a model. Asking for the same instance as YAML is one call to a
   * different writer.
   *
   * And YAML is genuinely a different serialisation, not JSON with different
   * punctuation — CEDAR's YAML instance nests the data under `children` and
   * calls a literal `value` rather than `@value`. That is the point: nothing in
   * CEE decides either of those things.
   */
  it.each(cases)('%s survives as YAML', (_label, index, cardinality) => {
    const driver = filled(index, cardinality);
    const yaml = InstanceSerializer.toYaml(driver.dataContext.instanceFullData);
    expect(yaml.length, 'no YAML was produced').toBeGreaterThan(0);

    const reparsed = parseYaml(yaml) as Record<string, any>;
    expect(reparsed.type).toBe('instance');
    expect(reparsed.children, 'the YAML instance has no children block').toBeTruthy();
    // An attribute-value field is not a child in the YAML representation — its
    // attributes are named at the point of use, so it sits at the root with the
    // names as keys. One more thing about the serialisation that CEE has no
    // opinion on and no longer needs one.
    const placed = Object.keys(reparsed.children).includes('_f') || Object.hasOwn(reparsed, '_f');
    expect(placed, 'the field appears nowhere in the YAML').toBe(true);
  });

  it('carries a literal through to the YAML', () => {
    const driver = filled(
      VALUED.findIndex((k) => k.key === 'text'),
      'single',
    );
    const reparsed = parseYaml(InstanceSerializer.toYaml(driver.dataContext.instanceFullData)) as Record<string, any>;
    expect(reparsed.children._f.value).toBe('some text');
  });

  it('is empty for an instance that does not exist', () => {
    expect(InstanceSerializer.toYaml(null as never)).toBe('');
  });

  it('produces YAML, not JSON', () => {
    const yaml = InstanceSerializer.toYaml(filled(0, 'single').dataContext.instanceFullData);
    expect(yaml.trimStart().startsWith('{'), 'that is JSON').toBe(false);
    expect(yaml).toContain('_f:');
  });
});
