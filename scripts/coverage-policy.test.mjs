import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import coverageV8 from '@vitest/coverage-v8';
import config from '../vitest.config.mts';

const root = fileURLToPath(new URL('../', import.meta.url));

const widgetFile = (name) =>
  path.join(
    'src/app/modules/input-types/components',
    name === 'authority'
      ? 'authority/abstract-authority-input.component.ts'
      : `cedar-input-${name}/cedar-input-${name}.component.ts`,
  );

// Use the installed provider's threshold checker: asserting that perFile is set
// would not prove what the coverage gate actually does with an untested widget.
async function checkWidget(widget, hits) {
  return checkFiles([
    [widgetFile('text'), 100, 1],
    [widgetFile(widget), 1, hits],
  ]);
}

/** The gate's verdict on a coverage map holding these files, each as `[path, statements, hits]`. */
async function checkFiles(files) {
  const provider = await coverageV8.getProvider();
  const errors = [];
  provider.ctx = { config: { root }, logger: { error: (message) => errors.push(message) } };
  provider.options = config.test.coverage;
  const coverage = provider.createCoverageMap();
  for (const [relative, count, executed] of files) {
    const file = path.join(root, relative);
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

test('an untested save snapshot fails its own floor even when everything else is covered', async () => {
  const snapshot = 'src/app/modules/shared/util/instance-save-snapshot.ts';
  assert.deepEqual(
    await checkFiles([
      [widgetFile('text'), 100, 1],
      [snapshot, 40, 1],
    ]),
    { exitCode: 0, errors: [] },
  );
  const result = await checkFiles([
    [widgetFile('text'), 100, 1],
    [snapshot, 40, 0],
  ]);
  assert.equal(result.exitCode, 1);
  assert.ok(result.errors.some((message) => message.includes('instance-save-snapshot.ts')));
});

test('an untested field reveal fails its own floor even when everything else is covered', async () => {
  const reveal = 'src/app/modules/shared/service/field-reveal.service.ts';
  assert.deepEqual(
    await checkFiles([
      [widgetFile('text'), 100, 1],
      [reveal, 78, 1],
    ]),
    { exitCode: 0, errors: [] },
  );
  const result = await checkFiles([
    [widgetFile('text'), 100, 1],
    [reveal, 78, 0],
  ]);
  assert.equal(result.exitCode, 1);
  assert.ok(result.errors.some((message) => message.includes('field-reveal.service.ts')));
});
