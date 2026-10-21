import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, uptime } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function gate(mode, workers, fail = '', environment = {}, copies = 1) {
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
    const script = fileURLToPath(new URL('./test-gate.mjs', import.meta.url));
    // Several copies run at once, as gates in concurrent builds do.
    const command = copies === 1 ? [process.execPath, [script, mode]]
      : ['sh', ['-c', `for i in $(seq ${copies}); do "$GATE_NODE" "$GATE_SCRIPT" "$GATE_MODE" & done; wait`]];
    const result = spawnSync(...command, {
      encoding: 'utf8', env: { ...process.env, PATH: `${directory}:${process.env.PATH}`,
        GATE_NODE: process.execPath, GATE_SCRIPT: script, GATE_MODE: mode,
        CEDAR_TEST_WORKERS: String(workers), GATE_LOG: log, GATE_FAIL: fail,
        // A build runs these tests inside its own pool, which no test may draw on.
        CEDAR_WORKER_POOL: undefined, ...environment },
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

function sharedPool(size) {
  const directory = mkdtempSync(path.join(tmpdir(), 'cee-pool-'));
  writeFileSync(path.join(directory, 'size'), `${size}\n`);
  return directory;
}
const slots = pool => readdirSync(pool).filter(name => name.startsWith('slot-'));

test("stages stay within the build's shared pool and return every worker", () => {
  const pool = sharedPool(3);
  try {
    const { result, events } = gate('prebuilt', 8, '', { CEDAR_WORKER_POOL: pool });
    assert.equal(result.status, 0, result.stderr);
    let active = 0;
    for (const event of events) {
      active += (event.event === 'start' ? 1 : -1) * Number(event.workers);
      assert.ok(active <= 3, `${active} workers from a pool of 3`);
    }
    assert.equal(new Set(events.map(event => event.script)).size, 7);
    assert.deepEqual(slots(pool), []);
  } finally { rmSync(pool, { recursive: true, force: true }); }
});

test('a stage waits for workers held elsewhere and takes them back once their holder exits', () => {
  const pool = sharedPool(2);
  try {
    // An orphaned sleep is reaped as soon as it exits, so its slots read as abandoned from then on.
    const holder = spawnSync('sh', ['-c', 'sleep 0.6 >/dev/null 2>&1 & echo $!'], { encoding: 'utf8' }).stdout;
    for (const slot of ['slot-0', 'slot-1']) {
      mkdirSync(path.join(pool, slot));
      writeFileSync(path.join(pool, slot, 'owner'), holder);
    }
    const began = Date.now();
    const { result, events } = gate('prebuilt', 2, '', { CEDAR_WORKER_POOL: pool });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(Date.now() - began >= 500, 'the gate did not wait for the workers held elsewhere');
    assert.equal(new Set(events.map(event => event.script)).size, 7);
    assert.deepEqual(slots(pool), []);
  } finally { rmSync(pool, { recursive: true, force: true }); }
});

// How the gate names this boot: when the machine started, in whole seconds.
const boot = () => Math.round(Date.now() / 1000 - uptime());

test('a stage waits behind an older request from a process that is still running', () => {
  const pool = sharedPool(4);
  try {
    // An orphaned sleep is reaped as soon as it exits, so its request is dropped from then on.
    const holder = spawnSync('sh', ['-c', 'sleep 0.6 >/dev/null 2>&1 & echo $!'], { encoding: 'utf8' }).stdout.trim();
    const arrived = (BigInt(Date.now() - 1000) * 1000000n).toString().padStart(20, '0');
    mkdirSync(path.join(pool, 'queue'));
    writeFileSync(path.join(pool, 'queue', `${arrived}-${holder}-${boot()}-older`), '');
    const began = Date.now();
    const { result, events } = gate('prebuilt', 2, '', { CEDAR_WORKER_POOL: pool });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(Date.now() - began >= 500, 'the gate overtook the older request');
    assert.equal(new Set(events.map(event => event.script)).size, 7);
    assert.deepEqual(readdirSync(path.join(pool, 'queue')), []);
  } finally { rmSync(pool, { recursive: true, force: true }); }
});

test('workers and requests left from an earlier boot are taken back though their process number is in use', () => {
  const pool = sharedPool(1);
  try {
    mkdirSync(path.join(pool, 'slot-0'));
    writeFileSync(path.join(pool, 'slot-0', 'owner'), `${process.pid} ${boot() - 86400}\n`);
    mkdirSync(path.join(pool, 'queue'));
    const arrived = (BigInt(Date.now() - 1000) * 1000000n).toString().padStart(20, '0');
    writeFileSync(path.join(pool, 'queue', `${arrived}-${process.pid}-${boot() - 86400}-earlier`), '');
    const { result, events } = gate('prebuilt', 1, '', { CEDAR_WORKER_POOL: pool });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(new Set(events.map(event => event.script)).size, 7);
    assert.deepEqual(slots(pool), []);
    assert.deepEqual(readdirSync(path.join(pool, 'queue')), []);
  } finally { rmSync(pool, { recursive: true, force: true }); }
});

test('gates in concurrent builds stay within the pool they share', () => {
  const pool = sharedPool(3);
  try {
    const { events } = gate('prebuilt', 8, '', { CEDAR_WORKER_POOL: pool }, 2);
    let active = 0;
    for (const event of events) {
      active += (event.event === 'start' ? 1 : -1) * Number(event.workers);
      assert.ok(active <= 3, `${active} workers from a pool of 3`);
    }
    assert.equal(events.filter(event => event.event === 'end').length, 14, 'both gates ran every stage');
    assert.deepEqual(slots(pool), []);
  } finally { rmSync(pool, { recursive: true, force: true }); }
});
