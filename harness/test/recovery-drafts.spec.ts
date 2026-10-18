import { describe, expect, it } from 'vitest';
import { CeeDriver } from '../src/driver';
import { draftTemplate } from '../src/validation-state-fixtures';
import { childOf, InstanceNode } from '@cee/models/instance-node.model';

describe('recovery input addresses', () => {
  for (const depth of [1, 3, 6])
    for (const readOnlyMode of [false, true])
      it(`restores unfinished input at depth ${depth}, readOnly=${readOnlyMode}`, () => {
        const template = draftTemplate(depth, 'temporal');
        const before = new CeeDriver(template);
        const root = before.dataContext.instanceFullData!.dataContainer;
        const path: Array<string | number> = [];
        for (let level = 0; level < depth; level++) path.push(`_level${level}`, level === depth - 1 ? 1 : 0);
        path.push('_f');
        const node = path.reduce<InstanceNode | null>((parent, key) => childOf(parent, key), root)!;
        const input = {
          code: 'temporalDraft',
          message: 'Complete date',
          value: '2026-',
          state: { date: '2026-', time: '' },
        };
        before.handlerContext.validation.restoreDraft(node, input);
        const draft = JSON.parse(JSON.stringify(before.handlerContext.validation.captureDrafts(root)));
        expect(draft).toEqual([{ path, draft: input }]);
        const after = new CeeDriver(template, { instance: before.emitted, readOnlyMode });
        const restored = after.dataContext.instanceFullData!.dataContainer;
        after.handlerContext.validation.restoreDrafts(restored, draft);
        after.handlerContext.buildQualityReport();
        expect(after.qualityReport.isValid).toBe(false);
        expect(after.qualityReport.problems).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'temporalDraft', value: '2026-' })]),
        );
        expect(after.emitted).toEqual(before.emitted);
        draft[0].draft.state.date = 'host mutation';
        expect(after.handlerContext.validation.captureDrafts(restored)[0].draft.state).toEqual(input.state);
      });

  it('rejects invalid or duplicate addresses before attaching any input', () => {
    const driver = new CeeDriver(draftTemplate(1, 'temporal'));
    const root = driver.dataContext.instanceFullData!.dataContainer;
    const coordinator = driver.handlerContext.validation;
    const entry = {
      path: ['_level0', 0, '_f'],
      draft: { code: 'draft', message: 'unfinished', value: 'x', state: {} },
    };
    for (const invalid of [
      null,
      [entry, entry],
      [entry, { ...entry, path: [] }],
      [entry, { ...entry, path: [false] }],
      [entry, { ...entry, path: ['_level0', -1] }],
      [entry, { ...entry, path: ['_level0', 99, '_f'] }],
      [entry, { ...entry, path: ['missing'] }],
      [{ ...entry, draft: {} }],
    ]) {
      expect(() => coordinator.restoreDrafts(root, invalid as never)).toThrow();
      expect(coordinator.captureDrafts(root)).toEqual([]);
    }
  });
});
