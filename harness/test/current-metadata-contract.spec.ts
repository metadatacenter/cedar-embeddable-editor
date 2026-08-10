/**
 * The host-facing `currentMetadata` contract.
 *
 * The AngularJS host reads `cee.currentMetadata` when the user saves and
 * branches on `@id` to choose create vs update. `currentMetadata` runs CEE's
 * working tree through `InstanceSerializer.toJson` — the model library's writer
 * — so this pins what that writer hands back for the two states the host turns
 * on, and the value shapes it reads back for the field kinds it renders:
 *
 *   - a not-yet-created instance carries `@id: null` — present, null, not
 *     omitted. The host must read that as "create". A host that tested only
 *     `@id === undefined` took the update path and crashed on the null id;
 *     stating the shape here catches a drift back to an omitted key, or to a
 *     minted id, on this side of the contract rather than in production.
 *   - an instance the host loaded to edit carries its existing `@id` back out
 *     unchanged — not nulled, not dropped — so the host updates it in place.
 *     `instance-output.spec.ts` injects such an instance but asserts only
 *     `schema:isBasedOn`; the surviving `@id` is pinned here.
 *
 * Asserted through `InstanceSerializer.toJson(...)`, the exact call behind the
 * getter. (`CeeDriver.metadata` is a raw clone of the working tree and does not
 * pass through the writer, so it is deliberately not used here.)
 */
import { describe, expect, it } from 'vitest';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { buildTemplate } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';
import { CeeDriver } from '../src/driver';
import { JsonSchema } from 'cedar-model-typescript-library';
import { instanceWith, iriOf, literalValue } from '../src/values';

const TEXT = FIELD_KINDS.find((k) => k.key === 'text')!;
const CONTROLLED = FIELD_KINDS.find((k) => k.key === 'controlled')!;

/** `currentMetadata` as the host reads it: the working tree, through the writer. */
const currentMetadata = (driver: CeeDriver): Record<string, unknown> =>
  InstanceSerializer.toJson(driver.fullData) as Record<string, unknown>;

describe('currentMetadata for a not-yet-created instance', () => {
  const fresh = () => {
    const driver = new CeeDriver(buildTemplate({ name: 'cm_new', children: [{ kind: TEXT, name: 'note' }] }));
    driver.setValue(['_note'], TEXT, 'hello');
    return driver;
  };

  it('carries @id as null — present, not omitted', () => {
    const md = currentMetadata(fresh());
    expect(JsonSchema.atId in md, 'the identifier must be present in the emitted instance').toBe(true);
    expect(md[JsonSchema.atId], 'a new instance has no IRI yet, so the identifier is null').toBeNull();
  });

  it('is the shape the host reads as "create"', () => {
    // The host treats null OR undefined as "not yet created". The writer's choice
    // of null — rather than omitting the key — is exactly what a host that tested
    // `=== undefined` alone mishandled; pinned so it cannot drift back unnoticed.
    expect(currentMetadata(fresh())[JsonSchema.atId] == null).toBe(true);
  });

  it('carries the typed value back out', () => {
    expect(currentMetadata(fresh())['_note']).toEqual({ '@value': 'hello' });
  });
});

describe('currentMetadata for an instance the host loaded to edit', () => {
  const EXISTING = 'https://repo.metadatacenter.org/template-instances/edit-abc-123';

  const loaded = () => {
    const templateIri = 'https://repo.metadatacenter.org/templates/cm_edit';
    const template = buildTemplate({ name: 'cm_edit', children: [{ kind: TEXT, name: 'note' }] }) as Record<
      string,
      unknown
    >;
    template[JsonSchema.atId] = templateIri;
    return new CeeDriver(template, {
      instance: instanceWith(templateIri, { _note: literalValue('loaded') }, EXISTING),
    });
  };

  it('emits the existing @id unchanged — not nulled, not dropped', () => {
    expect(
      currentMetadata(loaded())[JsonSchema.atId],
      'a loaded instance keeps its IRI so the host updates in place',
    ).toBe(EXISTING);
  });

  it('is the shape the host reads as "update"', () => {
    expect(currentMetadata(loaded())[JsonSchema.atId] != null).toBe(true);
  });

  it('brings the loaded value back out', () => {
    expect(currentMetadata(loaded())['_note']).toEqual({ '@value': 'loaded' });
  });
});

describe('currentMetadata collects each field shape the host renders', () => {
  it('a text field, as a literal value node', () => {
    const driver = new CeeDriver(buildTemplate({ name: 'cm_text', children: [{ kind: TEXT, name: 'note' }] }));
    driver.setValue(['_note'], TEXT, 'free text');
    driver.expectNoErrors('text collect');
    expect(currentMetadata(driver)['_note']).toEqual({ '@value': 'free text' });
  });

  it('a controlled-term field, as @id plus rdfs:label', () => {
    const driver = new CeeDriver(buildTemplate({ name: 'cm_ct', children: [{ kind: CONTROLLED, name: 'organism' }] }));
    driver.setValue(['_organism'], CONTROLLED, 'Homo sapiens');
    driver.expectNoErrors('controlled collect');
    const value = currentMetadata(driver)['_organism'] as Record<string, unknown>;
    expect(value['rdfs:label']).toBe('Homo sapiens');
    expect(typeof iriOf(value), 'a controlled term carries an IRI').toBe('string');
  });

  it('a field inside an element, as a nested object', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'cm_el',
        elements: [{ name: 'address', children: [{ kind: TEXT, name: 'city' }] }],
      }),
    );
    driver.setValue(['_address', '_city'], TEXT, 'Palo Alto');
    driver.expectNoErrors('element collect');
    const element = currentMetadata(driver)['_address'] as Record<string, unknown>;
    expect(element['_city']).toEqual({ '@value': 'Palo Alto' });
  });
});
