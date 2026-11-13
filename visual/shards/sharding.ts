import { createHash } from 'node:crypto';

export interface ShardCase {
  id: string;
  project: string;
  file: string;
  title: string;
  expectedStatus: string;
}

export interface DurationProfile {
  version: number;
  milliseconds: Record<string, number>;
}

export const durationKey = (test: Pick<ShardCase, 'project' | 'file'>): string => `${test.project}/${test.file}`;

export function inventoryHash(ids: string[]): string {
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate test identity in shard inventory');
  return createHash('sha256')
    .update(JSON.stringify([...ids].sort()))
    .digest('hex');
}

/** Durations affect assignment only. Unknown and newly added cases always enter the plan. */
export function planShards(tests: ShardCase[], total: number, profile: DurationProfile) {
  if (!Number.isInteger(total) || total < 1) throw new Error('Shard count must be a positive integer');
  inventoryHash(tests.map((test) => test.id));
  const measured = Object.values(profile.milliseconds);
  if (profile.version !== 1 || measured.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error('Invalid shard duration profile');
  const fallback = measured.length ? Math.max(1, measured.reduce((a, b) => a + b, 0) / measured.length) : 1000;
  const weighted = tests.map((test) => ({
    test,
    milliseconds: test.expectedStatus === 'skipped' ? 0 : (profile.milliseconds[durationKey(test)] ?? fallback),
  }));
  // Stable ties make the plan independent of filesystem order and the runner's locale.
  weighted.sort((a, b) => b.milliseconds - a.milliseconds || (a.test.id < b.test.id ? -1 : 1));
  const shards = Array.from({ length: total }, (_, index) => ({
    index: index + 1,
    milliseconds: 0,
    tests: [] as ShardCase[],
  }));
  for (const { test, milliseconds } of weighted) {
    const shard = shards.reduce((best, row) =>
      row.milliseconds < best.milliseconds ||
      (row.milliseconds === best.milliseconds && row.tests.length < best.tests.length)
        ? row
        : best,
    );
    shard.tests.push(test);
    shard.milliseconds += milliseconds;
  }
  return shards;
}

export interface ShardReport {
  version: number;
  shard: { current: number; total: number };
  inventory: { count: number; sha256: string };
  profileSha256: string;
  status: string;
  durationMs: number;
  tests: (ShardCase & { outcome: string; attempts: { status: string; retry: number; durationMs: number }[] })[];
}

/** Fail closed: four green jobs must collectively have run the complete discovered inventory. */
export function verifyReports(reports: ShardReport[], total: number) {
  if (reports.length !== total) throw new Error(`Expected ${total} shard reports, received ${reports.length}`);
  const first = reports[0];
  if (!first || first.inventory.count < 1) throw new Error('Empty shard inventory');
  const seenShards = new Set<number>();
  const ids: string[] = [];
  let passed = 0;
  let skipped = 0;
  for (const report of reports) {
    const { current } = report.shard;
    if (
      report.version !== 1 ||
      report.shard.total !== total ||
      !Number.isInteger(current) ||
      current < 1 ||
      current > total ||
      seenShards.has(current)
    )
      throw new Error('Invalid or duplicate shard report');
    seenShards.add(current);
    if (
      report.inventory.count !== first.inventory.count ||
      report.inventory.sha256 !== first.inventory.sha256 ||
      report.profileSha256 !== first.profileSha256
    )
      throw new Error('Shards used different inventories or duration profiles');
    if (report.status !== 'passed') throw new Error(`Shard ${current} did not pass`);
    for (const test of report.tests) {
      ids.push(test.id);
      const attempt = test.attempts[0];
      if (test.attempts.length !== 1 || attempt?.retry !== 0)
        throw new Error(`Missing or retried execution: ${test.id}`);
      if (test.outcome === 'skipped' && attempt.status === 'skipped') skipped++;
      else if (test.outcome === 'expected' && attempt.status === test.expectedStatus) passed++;
      else throw new Error(`Unexpected test result: ${test.id}`);
    }
  }
  if (ids.length !== first.inventory.count || inventoryHash(ids) !== first.inventory.sha256)
    throw new Error('Shard union does not equal the complete test inventory');
  return {
    total: ids.length,
    passed,
    skipped,
    shards: total,
    slowestSeconds: Math.max(...reports.map((r) => r.durationMs)) / 1000,
  };
}
