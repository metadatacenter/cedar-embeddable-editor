// One gate, with bounded independent stages. Angular build and coordinator tests
// share a cache, so they are ordered; screenshots always inspect the built bytes.
import { spawn } from 'node:child_process';
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
const start = performance.now();

function stop(signal) {
  failed = true;
  pending.length = 0;
  for (const child of running.values()) {
    try { child.kill(signal); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

function schedule() {
  if (!failed) {
    for (const stage of [...pending]) {
      const weight = stage.weight ?? 1;
      if (used + weight > budget || !(stage.after ?? []).every(name => passed.has(name))) continue;
      pending.splice(pending.indexOf(stage), 1);
      used += weight;
      const began = performance.now();
      console.log(`[gate] start ${stage.name} (${weight}/${budget} workers)`);
      const child = spawn('npm', ['run', stage.script], {
        // Stay in the CLI process group so cancellation reaps test descendants.
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CEDAR_TEST_WORKERS: String(weight), VITEST_MAX_WORKERS: String(weight), NG_BUILD_MAX_WORKERS: String(weight) },
      });
      running.set(stage.name, child);
      for (const stream of [child.stdout, child.stderr]) {
        stream.on('data', data => process.stdout.write(`[${stage.name}] ${data}`));
      }
      child.on('error', error => { console.error(error); failed = true; process.exitCode = 1; });
      child.on('close', code => {
        running.delete(stage.name);
        used -= weight;
        const seconds = ((performance.now() - began) / 1000).toFixed(2);
        console.log(`[gate] ${stage.name}: exit ${code}, ${seconds}s`);
        if (code === 0) passed.add(stage.name);
        else { failed = true; process.exitCode ||= 1; }
        schedule();
      });
    }
  }
  if (running.size === 0) {
    if (!failed && pending.length) throw new Error('No runnable gate stages');
    console.log(`[gate] ${failed ? 'FAILED' : 'PASSED'} in ${((performance.now() - start) / 1000).toFixed(2)}s`);
  }
}
schedule();
