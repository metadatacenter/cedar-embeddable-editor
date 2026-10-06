/**
 * Read-only mode.
 *
 * CEE has two operating modes. The domain layer's share of read-only is
 * smaller than it looks — most of the effect is in the widgets — but it is not
 * nothing, and none of it was covered: `DataContext.setInputTemplate` used to
 * skip building the quality report entirely when read-only.
 *
 * User-originated commands are refused by the controller. Explicit host assignments
 * remain available and still rebuild the quality report.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { instanceWith as buildInstance, literalValue, heldValue } from '../src/values';

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;
const TEXT = kind('textfield');

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
    const validTemplate = template();
    const bad = buildInstance(
      (validTemplate as Record<string, string>)['@id'],
      { _a: literalValue('fine') },
      'https://example.org/i/1',
    );
    const viewer = new CeeDriver(validTemplate, { readOnlyMode: true, instance: bad });
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

  it('rejects user edits while accepting explicit host writes', () => {
    const driver = new CeeDriver(template(), { readOnlyMode: true });
    driver.setValue(['_a'], TEXT, 'late user edit');
    expect(heldValue(driver.handlerContext.getDataObjectNodeByPath(['_a']))).toBeNull();
    expect(driver.qualityReport.isValid).toBe(false);

    driver.handlerContext.changeValue(driver.findOrThrow(['_a']), 'host assignment', null, 'host');
    expect(heldValue(driver.handlerContext.getDataObjectNodeByPath(['_a']))).toBe('host assignment');
    expect(driver.qualityReport.isValid).toBe(true);
    driver.expectNoErrors('host write in read-only mode');
  });
});
