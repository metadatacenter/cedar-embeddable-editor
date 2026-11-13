import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestRun } from '@playwright/test/reporter';
import { inventoryHash, planShards, type DurationProfile, type ShardCase, type ShardReport } from './sharding';

/** Use Playwright's public preprocessing API; keep its project/worker scheduling intact. */
export default class BalancedShardReporter implements Reporter {
  private config!: FullConfig;
  private inventory!: ShardReport['inventory'];
  private selected: ShardCase[] = [];
  private tests: TestCase[] = [];
  private profileSha256 = '';

  printsToStdio(): boolean {
    return false;
  }

  async preprocess({ config, suite, testRun }: { config: FullConfig; suite: Suite; testRun: TestRun }): Promise<void> {
    if (!config.fullyParallel) throw new Error('CEE balanced shards require the fully parallel test suite');
    this.config = config;
    const source = readFileSync(new URL('./durations.json', import.meta.url), 'utf8');
    this.profileSha256 = createHash('sha256').update(source).digest('hex');
    const tests = suite.allTests();
    const cases = tests.map((test) => this.describe(test));
    this.inventory = { count: cases.length, sha256: inventoryHash(cases.map((test) => test.id)) };
    const shard = config.shard ?? { current: 1, total: 1 };
    const plan = planShards(cases, shard.total, JSON.parse(source) as DurationProfile);
    this.selected = plan[shard.current - 1].tests;
    if (config.shard) {
      const selected = new Set(this.selected.map((test) => test.id));
      testRun.skipSharding();
      for (const test of tests) if (!selected.has(this.describe(test).id)) testRun.exclude(test);
    }
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.tests = suite.allTests();
    if (
      inventoryHash(this.tests.map((test) => this.describe(test).id)) !==
      inventoryHash(this.selected.map((test) => test.id))
    )
      throw new Error('Playwright selected a different inventory from the balanced shard plan');
  }

  onEnd(result: FullResult): void {
    if (!this.inventory) return;
    const shard = this.config.shard ?? { current: 1, total: 1 };
    const report: ShardReport = {
      version: 1,
      shard,
      inventory: this.inventory,
      profileSha256: this.profileSha256,
      status: result.status,
      durationMs: result.duration,
      tests: this.tests.map((test) => ({
        ...this.describe(test),
        outcome: test.outcome(),
        attempts: test.results.map((attempt) => ({
          status: attempt.status,
          retry: attempt.retry,
          durationMs: attempt.duration,
        })),
      })),
    };
    const directory = resolve(this.config.rootDir, '../shard-results');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      resolve(directory, `shard-${shard.current}-of-${shard.total}.json`),
      JSON.stringify(report, null, 2) + '\n',
    );
  }

  private describe(test: TestCase): ShardCase {
    return {
      id: `${test.id}@${test.repeatEachIndex}`,
      project: test.parent.project()!.name,
      file: relative(this.config.rootDir, test.location.file).replaceAll('\\', '/'),
      title: test.titlePath().slice(2).join(' › '),
      expectedStatus: test.expectedStatus,
    };
  }
}
