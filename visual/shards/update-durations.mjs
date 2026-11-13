import { readFileSync, writeFileSync } from 'node:fs';
import { verifyReports } from './sharding.ts';

// Consume complete, passing Playwright JSON reports. Keep only small project/file means;
// no test identifier is an allowlist, and a stale estimate can only affect performance.
const [output, ...inputs] = process.argv.slice(2);
if (!output || !inputs.length) throw new Error('Usage: node shards/update-durations.mjs OUTPUT.json REPORT.json ...');
const groups = new Map();
const reports = inputs.map(input => JSON.parse(readFileSync(input, 'utf8')));
const shardReports = reports.every(report => report.version === 1 && Array.isArray(report.tests));
if (shardReports) verifyReports(reports, reports[0].shard.total);
function record(project, file, milliseconds) {
  const key = `${project}/${file}`;
  const values = groups.get(key) ?? [];
  values.push(milliseconds);
  groups.set(key, values);
}
for (const [index, report] of reports.entries()) {
  if (shardReports) {
    for (const test of report.tests) record(test.project, test.file, test.attempts[0].durationMs);
    continue;
  }
  if (report.errors.length || report.stats.unexpected || report.stats.flaky)
    throw new Error(`Refusing timings from a failed or flaky report: ${inputs[index]}`);
  function visit(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests) {
      if (test.results.length !== 1 || test.results[0].retry !== 0)
        throw new Error(`Refusing missing/retried timing for ${spec.title}`);
      record(test.projectName, spec.file, test.results[0].duration);
    }
    for (const child of suite.suites ?? []) visit(child);
  }
  for (const suite of report.suites) visit(suite);
}
if (!groups.size) throw new Error('No test timings found');
writeFileSync(output, JSON.stringify({ version: 1,
  milliseconds: Object.fromEntries([...groups].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => [key, Math.max(1, Math.round(values.reduce((a, b) => a + b, 0) / values.length))])),
}, null, 2) + '\n');
