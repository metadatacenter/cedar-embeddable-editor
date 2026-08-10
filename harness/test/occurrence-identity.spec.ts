/**
 * The IRI an element occurrence is identified by.
 *
 * CEDAR requires one on every occurrence, and CEE mints it — from the IRI prefix
 * the host configured, which is why it cannot come from the library. Three
 * claims, all of which used to be made about an `@id` property written into a
 * plain object and are now about `id` on the container: which key that becomes
 * is the writer's business, and the YAML writer calls it `id`.
 */
import { describe, expect, it } from 'vitest';
import { InstanceDataContainer } from 'cedar-model-typescript-library';
import { CedarBuilders } from 'cedar-model-typescript-library';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { FieldKind } from '../src/axes';
import { DataObjectBuilderHandler } from '@cee/handler/data-object-builder.handler';
import { InstanceNode, isInstanceObject } from '@cee/models/instance-node.model';
import { literalValue } from '../src/values';

const TEXT = {
  key: 'text',
  inputType: 'textfield',
  make: () => CedarBuilders.textFieldBuilder(),
  isStatic: false,
  write: 'value',
  sample: 'a value',
} as unknown as FieldKind;

const withOccurrences = () =>
  buildTemplate({
    name: 'oi_multi',
    elements: [{ name: 'el', cardinality: 'multi', minItems: 2, maxItems: 5, children: [{ kind: TEXT, name: 'f' }] }],
  });

describe('minting an occurrence IRI', () => {
  it('gives one to a container that has none', () => {
    const builder = new DataObjectBuilderHandler(() => 'https://example.org/');
    const container = new InstanceDataContainer();

    builder.addRandomAtId(container);

    expect(container.id).toMatch(/^https:\/\/example\.org\/template-element-instances\//);
  });

  /**
   * An occurrence that arrived with an IRI keeps it. A loaded instance carries
   * identities the host assigned, and minting over them would rewrite the user's
   * data on load.
   */
  it('leaves an existing one alone', () => {
    const builder = new DataObjectBuilderHandler(() => 'https://example.org/');
    const container = new InstanceDataContainer();
    container.id = 'https://elsewhere.example/instances/kept';

    builder.addRandomAtId(container);

    expect(container.id).toBe('https://elsewhere.example/instances/kept');
  });

  /** Anything that is not a container has no identity to give it. */
  it('does nothing to a value', () => {
    const builder = new DataObjectBuilderHandler(() => 'https://example.org/');
    expect(() => builder.addRandomAtId(literalValue('a value'))).not.toThrow();
  });
});

describe('a built instance', () => {
  it('gives every occurrence an IRI of its own', () => {
    const driver = new CeeDriver(withOccurrences());
    const occurrences = driver.fullData.values['_el'];
    expect(Array.isArray(occurrences)).toBe(true);

    const ids = (occurrences as InstanceNode[]).map((o) => (isInstanceObject(o) ? o.id : null));
    expect(
      ids.every((id) => typeof id === 'string' && id.length > 0),
      'an occurrence has no IRI',
    ).toBe(true);
    expect(new Set(ids).size, 'two occurrences share an IRI').toBe(ids.length);
  });
});
