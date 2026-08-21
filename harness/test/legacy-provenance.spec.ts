/**
 * Compatibility for provenance placeholders stored by older CEDAR releases.
 *
 * Production contains schema artifacts, and potentially instances, whose
 * optional `pav:derivedFrom` is the empty string. Opening one must not strand
 * it before the artifact server's inherited-defect repair can run. The model
 * reader treats that legacy spelling as absence; its writer then omits it.
 */
import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';
import { CeeDriver } from '../src/driver';

const TEXT = FIELD_KINDS.find((kind) => kind.key === 'text')!;

const templateWithField = () =>
  buildTemplate({
    name: 'legacy provenance',
    children: [{ kind: TEXT, name: 'text' }],
  }) as Record<string, any>;

describe('legacy empty pav:derivedFrom', () => {
  it('opens a template carrying it at the root and on a child', () => {
    const legacy = templateWithField();
    legacy['pav:derivedFrom'] = '';
    legacy.properties._text['pav:derivedFrom'] = '';

    const driver = new CeeDriver(legacy);

    expect(driver.representation).not.toBeNull();
    expect(driver.emitted['schema:isBasedOn']).toBe(legacy['@id']);
    driver.expectNoErrors('legacy template provenance load');
  });

  it('opens an instance carrying it and omits it on output', () => {
    const template = templateWithField();
    const legacy = new CeeDriver(template).metadata;
    legacy['pav:derivedFrom'] = '';

    const loaded = new CeeDriver(template, { instance: legacy });

    expect(loaded.metadata).not.toHaveProperty('pav:derivedFrom');
    expect(legacy['pav:derivedFrom']).toBe('');
    loaded.expectNoErrors('legacy instance provenance load');
  });
});
