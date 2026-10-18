import { afterEach, describe, expect, it, vi } from 'vitest';
import { CedarBuilders, RegexChecks } from 'cedar-model-typescript-library';
import { FIELD_KINDS, FieldKind } from '../src/axes';
import { carriedValue } from '@cee/util/carried-value';
import { FieldComponent } from '@cee/models/component/field-component.model';
import { ValidationProblem } from '@cee/validation/validation-problem.model';
import { CeeDriver } from '../src/driver';
import { buildTemplate } from '../src/generate';

const patternField = (regex: string): FieldKind => ({
  ...FIELD_KINDS.find((kind) => kind.key === 'text')!,
  make: () => CedarBuilders.textFieldBuilder(),
  configure: (builder) => builder.withRegex(regex),
});
const editor = (regex: string) => {
  const kind = patternField(regex);
  return { kind, driver: new CeeDriver(buildTemplate({ name: 'Patterns', children: [{ kind, name: 'f' }] })) };
};
afterEach(() => vi.unstubAllGlobals());

describe('bounded pattern validation', () => {
  it('reports pending separately, resolves the whole value, and notifies without a mutation', async () => {
    const { driver, kind } = editor('[A-Z]+');
    const validated = vi.fn();
    const edited = vi.fn();
    driver.handlerContext.setValidationListener(validated);
    driver.handlerContext.setMutationListener(edited);
    driver.setValue(['_f'], kind, 'aABC');
    expect(driver.qualityReport.pendingValidation).toBe(true);
    expect(driver.qualityReport.isValid).toBe(false);
    expect(driver.qualityReport.problems).toEqual([]);
    const mutations = edited.mock.calls.length;
    await driver.settled();
    expect(driver.qualityReport.problems.map((problem: ValidationProblem) => problem.code)).toEqual(['regex']);
    expect(driver.qualityReport.pendingValidation).toBeUndefined();
    expect(validated).toHaveBeenCalled();
    expect(edited).toHaveBeenCalledTimes(mutations);
    driver.setValue(['_f'], kind, 'ABC');
    await driver.settled();
    expect(driver.qualityReport.isValid).toBe(true);
  });

  it('bounds a pathological pattern and recovers on a newer value without losing either input', async () => {
    const { driver, kind } = editor('(a+)+');
    const value = 'a'.repeat(80) + '!';
    driver.setValue(['_f'], kind, value);
    await driver.settled();
    expect(driver.qualityReport.problems).toContainEqual(expect.objectContaining({ code: 'regexEvaluation' }));
    expect(driver.emitted._f).toMatchObject({ '@value': value });
    driver.setValue(['_f'], kind, 'aa');
    await driver.settled();
    expect(driver.qualityReport.isValid).toBe(true);
    expect(driver.emitted._f).toMatchObject({ '@value': 'aa' });
  });

  it('cancels obsolete values and does not report a stale mismatch', async () => {
    const { driver, kind } = editor('[A-Z]+');
    driver.setValue(['_f'], kind, 'wrong');
    driver.setValue(['_f'], kind, 'RIGHT');
    await driver.settled();
    expect(driver.qualityReport.isValid).toBe(true);
    expect(driver.qualityReport.problems).toEqual([]);
  });

  it('fails closed when workers are unavailable and retains the entered answer', async () => {
    vi.stubGlobal('Worker', undefined);
    const { driver, kind } = editor('[A-Z]+');
    driver.setValue(['_f'], kind, 'ABC');
    await driver.settled();
    expect(driver.qualityReport.isValid).toBe(false);
    expect(driver.qualityReport.problems).toContainEqual(expect.objectContaining({ code: 'regexEvaluation' }));
    expect(driver.emitted._f).toMatchObject({ '@value': 'ABC' });
  });

  it('retains an answer when a completed worker failure is available during carrying', async () => {
    const before = editor('');
    const after = editor('(a+)+');
    before.driver.setValue(['_f'], before.kind, 'a'.repeat(80) + '!');
    const source = before.driver.findOrThrow(['_f']) as FieldComponent;
    const target = after.driver.findOrThrow(['_f']) as FieldComponent;
    const answer = before.driver.handlerContext.getCurrentValueNode(source)!;
    const result = await RegexChecks.validate(() => carriedValue(source, target, answer));
    expect(result).toEqual(answer);
    expect(result).not.toBe(answer);
  });

  it('disposal cancels completion notifications', async () => {
    const { driver, kind } = editor('(a+)+');
    const completed = vi.fn();
    driver.handlerContext.setValidationListener(completed);
    driver.setValue(['_f'], kind, 'a'.repeat(80) + '!');
    driver.handlerContext.validation.dispose();
    await driver.settled();
    expect(completed).not.toHaveBeenCalled();
  });
});
