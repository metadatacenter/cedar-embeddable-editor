import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function gate(mode, workers, fail = '') {
  const directory = mkdtempSync(path.join(tmpdir(), 'cee-gate-'));
  const log = path.join(directory, 'events');
  writeFileSync(path.join(directory, 'npm'), `#!${process.execPath}
const fs = require('node:fs');
const script = process.argv[3];
const emit = event => fs.appendFileSync(process.env.GATE_LOG, JSON.stringify({event, script, workers: process.env.CEDAR_TEST_WORKERS, vitest: process.env.VITEST_MAX_WORKERS})+'\\n');
emit('start');
setTimeout(() => { emit('end'); process.exit(script === process.env.GATE_FAIL ? 7 : 0); }, 50);
`, { mode: 0o755 });
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./test-gate.mjs', import.meta.url)), mode], {
      encoding: 'utf8', env: { ...process.env, PATH: `${directory}:${process.env.PATH}`,
        CEDAR_TEST_WORKERS: String(workers), GATE_LOG: log, GATE_FAIL: fail },
    });
    return { result, events: readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)) };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

for (const budget of [1, 2, 8]) test(`full gate preserves outputs within a ${budget}-worker budget`, () => {
  const { result, events } = gate('full', budget);
  assert.equal(result.status, 0, result.stderr);
  let active = 0;
  let peak = 0;
  const finished = new Set();
  for (const event of events) {
    if (event.event === 'start') {
      assert.equal(event.vitest, event.workers);
      active += Number(event.workers);
      peak = Math.max(peak, active);
      assert.ok(active <= budget);
      if (event.script === 'test:coordinator') assert.ok(finished.has('build:production'));
      if (event.script === 'test:visual:prebuilt') assert.equal(finished.size, 6);
      if (event.script === 'package:npm:prebuilt') assert.ok(finished.has('test:visual:prebuilt'));
    } else { active -= Number(event.workers); finished.add(event.script); }
  }
  assert.equal(peak, budget);
  assert.equal(finished.size, 8);
});

test('failure fails the gate without running downstream stages', () => {
  const { result, events } = gate('full', 1, 'build:production');
  assert.notEqual(result.status, 0);
  assert.deepEqual(events.filter(e => e.event === 'start').map(e => e.script), ['build:production']);
});

test('nonvisual and prebuilt modes preserve gate membership', () => {
  for (const mode of ['nonvisual', 'prebuilt']) {
    const { result, events } = gate(mode, 2);
    assert.equal(result.status, 0, result.stderr);
    const scripts = events.filter(e => e.event === 'start').map(e => e.script);
    assert.equal(scripts.length, mode === 'prebuilt' ? 7 : 5);
    assert.ok(!scripts.includes('build:production'));
    assert.equal(scripts.includes('test:visual:prebuilt'), mode === 'prebuilt');
  }
});


test('visual wrapper preserves a failed container exit, with or without reactor mounts', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'cee-container-'));
  const log = path.join(directory, 'calls');
  mkdirSync(path.join(directory, '.reactor/artifacts'), { recursive: true });
  writeFileSync(path.join(directory, 'docker'), `#!/bin/bash
printf "%s\\n" "$1" >> "$DOCKER_TEST_LOG"
case "$1" in info|rm) exit 0;; run) exit 17;; esac
exit 99
`, { mode: 0o755 });
  try {
    for (const home of ['', directory]) {
      writeFileSync(log, '');
      const result = spawnSync('bash', [fileURLToPath(new URL('../visual/run-in-container.sh', import.meta.url))], {
        encoding: 'utf8', env: { ...process.env, CEDAR_HOME: home,
          PATH: `${directory}:${process.env.PATH}`, DOCKER_TEST_LOG: log },
      });
      assert.equal(result.status, 17, result.stderr);
      assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), ['info', 'run', 'rm']);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
