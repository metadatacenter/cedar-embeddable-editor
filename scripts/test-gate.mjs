// One gate, with bounded independent stages. Angular build and coordinator tests
// share a cache, so they are ordered; screenshots always inspect the built bytes.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { availableParallelism } from 'node:os';

const budget = Number(process.env.CEDAR_TEST_WORKERS ?? Math.max(1, Math.min(8, Math.floor(availableParallelism() / 2))));
if (!Number.isInteger(budget) || budget < 1 || budget > 16) {
  throw new Error('CEDAR_TEST_WORKERS must be an integer between 1 and 16');
}
const mode = process.argv[2] ?? 'full';
if (!['full', 'prebuilt', 'nonvisual'].includes(mode)) throw new Error(`Unknown gate: ${mode}`);
// Reserve capacity for build/lint/types while giving the two large Vitest tiers
// more than one worker on larger machines. Never exceed the gate's total budget.
const suiteWorkers = Math.max(1, Math.min(2, Math.floor(budget / 3)));
const stages = [
  ...(mode === 'full' ? [{ name: 'build', script: 'build:production' }] : []),
  { name: 'domain', script: 'test:domain:coverage', weight: suiteWorkers },
  { name: 'unit', script: 'test:unit:ci', weight: suiteWorkers },
  { name: 'lint', script: 'lint' },
  { name: 'types', script: 'typecheck' },
  { name: 'coordinator', script: 'test:coordinator', weight: suiteWorkers, after: mode === 'full' ? ['build'] : [] },
  ...(mode !== 'nonvisual' ? [
    { name: 'visual', script: 'test:visual:prebuilt', weight: budget,
      after: ['domain', 'unit', 'lint', 'types', 'coordinator', ...(mode === 'full' ? ['build'] : [])] },
    { name: 'package', script: 'package:npm:prebuilt', after: ['visual'] },
  ] : []),
];
const pending = [...stages];
const running = new Map();
const passed = new Set();
let used = 0;
let failed = false;
let retry = null;
const start = performance.now();

// A frontend build shares one worker budget between the repositories it runs at once, and names it
// in CEDAR_WORKER_POOL: a directory holding one subdirectory per worker in use. Each stage then takes
// its workers from the pool, and starts once at least half of its weight is free. Requests wait in
// the pool's queue under names that sort by arrival, and only the oldest may take workers, so a
// stage that needs several is not overtaken by every smaller request that arrives after it.
const pool = process.env.CEDAR_WORKER_POOL;
const poolSize = pool ? Number(readFileSync(join(pool, 'size'), 'utf8')) : 0;
const held = new Set();
let ticket = null;

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}

// The oldest request still waiting, dropping those whose process has exited.
function first() {
  const queue = join(pool, 'queue');
  mkdirSync(queue, { recursive: true });
  for (const name of readdirSync(queue).sort()) {
    if (alive(Number(name.split('-')[1]))) return name;
    rmSync(join(queue, name), { force: true });
  }
  return null;
}

function claim(slot) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { mkdirSync(slot); } catch (error) {
      if (error.code !== 'EEXIST' || !abandoned(slot)) return false;
      rmSync(slot, { recursive: true, force: true });
      continue;
    }
    writeFileSync(join(slot, 'owner'), `${process.pid}\n`);
    held.add(slot);
    return true;
  }
  return false;
}

// Whether the process holding a slot has exited. A slot whose owner is still being written is in use.
function abandoned(slot) {
  let owner;
  try { owner = Number(readFileSync(join(slot, 'owner'), 'utf8')); } catch { return false; }
  return !alive(owner);
}

function give(slots) {
  for (const slot of slots) {
    rmSync(slot, { recursive: true, force: true });
    held.delete(slot);
  }
}

// The workers a stage of this weight starts with: all of them without a pool, otherwise as many as
// are free once every earlier request is served, or none while fewer than half of them are.
function take(weight) {
  if (!pool) return { count: weight, slots: [] };
  if (!ticket) {
    const arrived = (BigInt(Date.now()) * 1000000n).toString().padStart(20, '0');
    ticket = `${arrived}-${process.pid}-${Math.random().toString(16).slice(2, 10)}`;
    mkdirSync(join(pool, 'queue'), { recursive: true });
    writeFileSync(join(pool, 'queue', ticket), '');
  }
  if (first() !== ticket) return null;
  const want = Math.min(weight, poolSize);
  const slots = [];
  for (let index = 0; index < poolSize && slots.length < want; index++) {
    const slot = join(pool, `slot-${index}`);
    if (claim(slot)) slots.push(slot);
  }
  if (slots.length < Math.ceil(want / 2)) { give(slots); return null; }
  rmSync(join(pool, 'queue', ticket), { force: true });
  ticket = null;
  return { count: slots.length, slots };
}
process.on('exit', () => {
  give([...held]);
  if (ticket) rmSync(join(pool, 'queue', ticket), { force: true });
});

function stop(signal) {
  failed = true;
  pending.length = 0;
  clearTimeout(retry);
  retry = null;
  for (const child of running.values()) {
    try { child.kill(signal); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
  if (running.size === 0) schedule();
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

function schedule() {
  if (!failed) {
    for (const stage of [...pending]) {
      const weight = stage.weight ?? 1;
      if (used + weight > budget || !(stage.after ?? []).every(name => passed.has(name))) continue;
      const workers = take(weight);
      // Later stages queue behind this one rather than overtake it.
      if (!workers) { retry ??= setTimeout(() => { retry = null; schedule(); }, 250); break; }
      pending.splice(pending.indexOf(stage), 1);
      used += weight;
      const began = performance.now();
      console.log(`[gate] start ${stage.name} (${workers.count}/${budget} workers)`);
      const child = spawn('npm', ['run', stage.script], {
        // Stay in the CLI process group so cancellation reaps test descendants.
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CEDAR_TEST_WORKERS: String(workers.count), VITEST_MAX_WORKERS: String(workers.count), NG_BUILD_MAX_WORKERS: String(workers.count) },
      });
      running.set(stage.name, child);
      for (const stream of [child.stdout, child.stderr]) {
        stream.on('data', data => process.stdout.write(`[${stage.name}] ${data}`));
      }
      child.on('error', error => { console.error(error); failed = true; process.exitCode = 1; });
      child.on('close', code => {
        running.delete(stage.name);
        give(workers.slots);
        used -= weight;
        const seconds = ((performance.now() - began) / 1000).toFixed(2);
        console.log(`[gate] ${stage.name}: exit ${code}, ${seconds}s`);
        if (code === 0) passed.add(stage.name);
        else { failed = true; process.exitCode ||= 1; }
        schedule();
      });
    }
  }
  if (running.size === 0 && retry === null) {
    if (!failed && pending.length) throw new Error('No runnable gate stages');
    console.log(`[gate] ${failed ? 'FAILED' : 'PASSED'} in ${((performance.now() - start) / 1000).toFixed(2)}s`);
  }
}
schedule();
