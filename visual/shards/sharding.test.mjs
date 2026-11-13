import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inventoryHash, planShards, verifyReports } from './sharding.ts';

const sample = (id, project = 'desktop', file = 'form.spec.ts') => ({
  id: String(id), project, file, title: `Case ${id}`, expectedStatus: 'passed',
});
const profile = { version: 1, milliseconds: { 'firefox/axe.spec.ts': 9000, 'desktop/form.spec.ts': 1000 } };
const cases = Array.from({ length: 40 }, (_, i) => i < 20 ? sample(i, 'firefox', 'axe.spec.ts') : sample(i));

test('expensive browser work is distributed instead of concentrated in the first count-based shards', () => {
  const plan = planShards(cases, 4, profile);
  assert.deepEqual(plan.map(row => row.milliseconds), [50000, 50000, 50000, 50000]);
  assert.deepEqual(plan.map(row => row.tests.filter(test => test.project === 'firefox').length), [5, 5, 5, 5]);
});

test('every case, including new, skipped and repeated cases, belongs to exactly one shard at any size', () => {
  const inventory = [...cases, sample('new', 'new-engine', 'new.spec.ts'),
    { ...sample('skip'), expectedStatus: 'skipped' }, sample('repeat@1'), sample('repeat@2')];
  for (const count of [1, 2, 4, 7, 50]) {
    const plan = planShards(inventory, count, profile);
    assert.equal(inventoryHash(plan.flatMap(row => row.tests.map(test => test.id))), inventoryHash(inventory.map(test => test.id)));
    const reversed = planShards([...inventory].reverse(), count, profile);
    assert.deepEqual(plan, reversed, 'filesystem discovery order changed the assignment');
  }
});

test('stale timings never exclude a renamed case, and an empty profile still gives an even plan', () => {
  const unknown = cases.map(test => ({ ...test, file: 'renamed.spec.ts' }));
  for (const durations of [profile, { version: 1, milliseconds: {} }]) {
    const plan = planShards(unknown, 4, durations);
    assert.deepEqual(plan.map(row => row.tests.length), [10, 10, 10, 10]);
    assert.ok(plan.every(row => row.milliseconds > 0));
  }
});

test('ambiguous identities, invalid shard counts and corrupt estimates fail before filtering tests', () => {
  assert.throws(() => planShards([sample('same'), sample('same')], 4, profile), /Duplicate/);
  for (const count of [0, -1, 1.5, NaN]) assert.throws(() => planShards(cases, count, profile), /Shard count/);
  for (const value of [-1, NaN, Infinity])
    assert.throws(() => planShards(cases, 4, { version: 1, milliseconds: { bad: value } }), /Invalid/);
});

function reports() {
  const inventory = [...cases, { ...sample('existing-skip'), expectedStatus: 'skipped' }];
  return planShards(inventory, 4, profile).map(row => ({
    version: 1, shard: { current: row.index, total: 4 },
    inventory: { count: inventory.length, sha256: inventoryHash(inventory.map(test => test.id)) },
    profileSha256: 'same-profile', status: 'passed', durationMs: 1234,
    tests: row.tests.map(test => ({ ...test, outcome: test.expectedStatus === 'skipped' ? 'skipped' : 'expected',
      attempts: [{ status: test.expectedStatus, retry: 0, durationMs: 20 }] })),
  }));
}

test('the merge gate proves full coverage and retains declared skips separately', () => {
  assert.deepEqual(verifyReports(reports(), 4), { total: 41, passed: 40, skipped: 1, shards: 4, slowestSeconds: 1.234 });
});

test('green shard reports cannot hide an omitted, duplicate or unexpected case', () => {
  const omitted = reports(); omitted[0].tests.pop();
  assert.throws(() => verifyReports(omitted, 4), /union/);
  const duplicate = reports(); duplicate[0].tests.push(duplicate[1].tests.pop()); duplicate[0].tests.push(duplicate[0].tests[0]);
  assert.throws(() => verifyReports(duplicate, 4), /union|Duplicate/);
  const replaced = reports(); replaced[0].tests[0].id = 'not-in-the-inventory';
  assert.throws(() => verifyReports(replaced, 4), /union/);
  assert.throws(() => verifyReports(reports().slice(1), 4), /Expected 4/);
  const repeatedShard = reports(); repeatedShard[3] = repeatedShard[0];
  assert.throws(() => verifyReports(repeatedShard, 4), /duplicate shard/);
});

test('a retry, failure or different inventory/profile cannot count as a complete passing run', () => {
  for (const mutate of [
    rows => rows[0].tests[0].attempts.push({ status: 'passed', retry: 1, durationMs: 10 }),
    rows => { rows[0].tests[0].attempts[0].retry = 1; },
    rows => { rows[0].tests[0].attempts = []; },
    rows => { rows[0].tests[0].outcome = 'flaky'; },
    rows => { rows[0].tests[0].attempts[0].status = 'failed'; },
    rows => { rows[0].status = 'failed'; },
    rows => { rows[0].inventory.sha256 = 'different'; },
    rows => { rows[0].profileSha256 = 'different'; },
  ]) {
    const rows = reports(); mutate(rows);
    assert.throws(() => verifyReports(rows, 4));
  }
});
