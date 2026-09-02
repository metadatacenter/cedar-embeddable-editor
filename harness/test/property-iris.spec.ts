import { describe, expect, it } from 'vitest';
import { AbstractElementComponent } from '@cee/models/element/abstract-element-component.model';
import { CedarComponent } from '@cee/models/component/cedar-component.model';
import { FIELD_KINDS } from '../src/axes';
import { CeeDriver } from '../src/driver';
import { buildTemplate } from '../src/generate';

const text = FIELD_KINDS.find((kind) => kind.key === 'text');
if (text === undefined) throw new Error('the field-kind axis has no text field');

/**
 * Every property IRI belongs to a deployment in a parent container. The parser
 * already keeps those mappings for instance emission; the rendered child must
 * carry the same value so its heading can describe the deployment accurately.
 */
describe('property IRIs on the component tree', () => {
  it('follow fields and elements through nested deployments', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'property_iris',
        children: [{ kind: text, name: 'root_field' }],
        elements: [
          {
            name: 'outer',
            children: [{ kind: text, name: 'nested_field' }],
            elements: [{ name: 'inner', children: [{ kind: text, name: 'deep_field' }] }],
          },
        ],
      }),
    );

    const seen: CedarComponent[] = [];
    const check = (container: AbstractElementComponent): void => {
      for (const child of container.children) {
        seen.push(child);
        expect(child.propertyIri, `${child.path.join('.')} lost its property IRI`).toBe(
          container.contextEntries[child.name] ?? null,
        );
        if (child instanceof AbstractElementComponent) check(child);
      }
    };

    check(driver.representation as AbstractElementComponent);
    expect(seen.map((child) => child.name)).toEqual(['_root_field', '_outer', '_nested_field', '_inner', '_deep_field']);
    expect(seen.every((child) => child.propertyIri?.startsWith('https://schema.metadatacenter.org/properties/')))
      .toBe(true);
  });
});
