import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import coverageV8 from '@vitest/coverage-v8';
import config from '../vitest.config.mts';

const root = fileURLToPath(new URL('../', import.meta.url));

// Use the installed provider's threshold checker: asserting that perFile is set
// would not prove what the coverage gate actually does with an untested widget.
async function checkWidget(widget, hits) {
  const provider = await coverageV8.getProvider();
  const errors = [];
  provider.ctx = { config: { root }, logger: { error: (message) => errors.push(message) } };
  provider.options = config.test.coverage;
  const coverage = provider.createCoverageMap();
  for (const [name, count, executed] of [
    ['text', 100, 1],
    [widget, 1, hits],
  ]) {
    const relative =
      name === 'authority'
        ? 'authority/abstract-authority-input.component.ts'
        : `cedar-input-${name}/cedar-input-${name}.component.ts`;
    const file = path.join(root, 'src/app/modules/input-types/components', relative);
    const entry = { path: file, statementMap: {}, fnMap: {}, branchMap: {}, s: {}, f: {}, b: {} };
    for (let i = 0; i < count; i++) {
      const loc = { start: { line: i + 1, column: 0 }, end: { line: i + 1, column: 10 } };
      entry.statementMap[i] = loc;
      entry.fnMap[i] = { name: `fn${i}`, decl: loc, loc, line: i + 1 };
      entry.branchMap[i] = { type: 'if', loc, line: i + 1, locations: [loc, loc] };
      entry.s[i] = executed;
      entry.f[i] = executed;
      entry.b[i] = [executed, executed];
    }
    coverage.addFileCoverage(entry);
  }
  const previousExitCode = process.exitCode;
  try {
    process.exitCode = 0;
    provider.checkThresholds(provider.resolveThresholds(coverage));
    return { exitCode: process.exitCode, errors };
  } finally {
    process.exitCode = previousExitCode;
  }
}

test('covered widgets satisfy the configured floors', async () => {
  assert.deepEqual(await checkWidget('checkbox', 1), { exitCode: 0, errors: [] });
});

for (const widget of ['checkbox', 'new-widget', 'authority']) {
  test(`an uncovered ${widget} fails even when pooled coverage exceeds 99%`, async () => {
    const result = await checkWidget(widget, 0);
    assert.equal(result.exitCode, 1);
    const filename =
      widget === 'authority' ? 'abstract-authority-input.component.ts' : `cedar-input-${widget}.component.ts`;
    assert.ok(result.errors.some((message) => message.includes(filename)));
  });
}
