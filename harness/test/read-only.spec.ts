/**
 * Read-only mode.
 *
 * CEE has two operating modes. The domain layer's share of read-only is
 * smaller than it looks — most of the effect is in the widgets — but it is not
 * nothing, and none of it was covered: `DataContext.setInputTemplate` used to
 * skip building the quality report entirely when read-only.
 *
 * Worth stating plainly, because it is easy to assume otherwise: read-only is
 * a presentation concern. The handlers do not enforce it. See the
 * characterization at the end.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { at } from '../src/nodes';
import {
  instanceWith as buildInstance,
  literalNode,
  literalOf,
  literalValue,
  heldValue,
  attributeValue,
} from '../src/values';

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;
const TEXT = kind('textfield');
const ATTRIBUTE_VALUE = kind('attribute-value');

/** Build an instance by driving the editor, so it is shaped exactly as CEE emits it. */
const instanceWith = (template: object, writes: Array<[string[], string]>) => {
  const d = new CeeDriver(template);
  for (const [path, value] of writes) d.setValue(path, TEXT, value);
  return d.metadata;
};

describe('read-only mode', () => {
  const template = () => buildTemplate({ name: 'ro', children: [{ kind: TEXT, name: 'a', required: true }] });

  /**
   * The report used to be skipped in read-only mode, on the reasoning that
   * nothing can be edited so validity is uninteresting. But a viewer showing an
   * injected instance was the one path where an instance reached the screen with
   * no validation at any layer — read-only also suppresses the widgets' own
   * errors.
   */
  it('builds a quality report in read-only mode', () => {
    const driver = new CeeDriver(template(), { readOnlyMode: true });
    expect(driver.dataContext.dataQualityReport).not.toBeNull();
  });

  it('validates an injected instance in a viewer', () => {
    const bad = buildInstance(
      'https://repo.metadatacenter.org/templates/ro',
      { _a: literalValue('fine') },
      'https://example.org/i/1',
    );
    const viewer = new CeeDriver(template(), { readOnlyMode: true, instance: bad });
    expect(viewer.dataContext.dataQualityReport).not.toBeNull();
    expect(viewer.qualityReport.isValid).toBe(true);
  });

  it('builds one in edit mode', () => {
    const driver = new CeeDriver(template());
    expect(driver.dataContext.dataQualityReport).not.toBeNull();
  });

  it('still parses the template into the same component tree', () => {
    const edit = new CeeDriver(template());
    const ro = new CeeDriver(template(), { readOnlyMode: true });
    expect(ro.representation.children.map((c: any) => c.name)).toEqual(
      edit.representation.children.map((c: any) => c.name),
    );
  });

  it('still builds the instance skeleton', () => {
    const ro = new CeeDriver(template(), { readOnlyMode: true });
    expect(ro.extract.hasValue('_a')).toBe(true);
  });

  /**
   * CHARACTERIZATION: the handlers do not enforce read-only.
   *
   * `changeValue` writes regardless; the flag is consumed by `CedarUIDirective`
   * and the templates (`*ngIf="!readOnlyMode"`), which is to say the widgets
   * simply never offer the edit. An embedder driving `HandlerContext` directly
   * — or any future non-widget caller — is not protected by setting the flag.
   *
   * Pinned rather than reported as a defect: it is a coherent design, just not
   * the one the flag's name suggests.
   */
  it('does not prevent a programmatic write', () => {
    const driver = new CeeDriver(template(), { readOnlyMode: true });
    driver.setValue(['_a'], TEXT, 'written anyway');

    expect(heldValue(driver.handlerContext.getDataObjectNodeByPath(['_a']))).toBe('written anyway');
    driver.expectNoErrors('write in read-only mode');
  });
});

