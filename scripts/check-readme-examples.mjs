/**
 * Compile the README's TypeScript examples against the declarations CEE ships.
 *
 * The examples exist to show a host what a checked configuration looks like, and
 * one of them did the opposite: it set `showTemplateYaml`, a key removed when the
 * sixteen panel keys went, so the example whose subject is type safety was the only
 * thing in the README a compiler rejected — `TS2353: 'showTemplateYaml' does not
 * exist in type 'CeeConfig'`. Nothing noticed, because nothing had ever compiled a
 * README example.
 *
 * Reads the *staged* package rather than the repository, so what is checked is the
 * pair a host actually receives: the `.d.ts` and the README that ship together. It
 * runs after staging for that reason.
 *
 * Only fenced `ts` and `typescript` blocks are compiled. A `js` block is a runtime
 * example whose whole point is often that a host has no types, and a `bash` or
 * `html` block is not TypeScript at all.
 *
 * A block that is deliberately not a whole module — a method body shown inside a
 * framework's class, say — says so in its fence: ```ts fragment. Every renderer
 * highlights on the first word, so the marker costs nothing on the page, and it is
 * visible to whoever edits the example. The alternative was to infer it, and "this
 * does not parse as a module" is indistinguishable from the failure being looked for.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { ROOT, TARGET } from './npm-package.mjs';

const PACKAGE_NAME = 'cedar-embeddable-editor';
const FENCE = /```(ts|typescript)([^\n]*)\n([\s\S]*?)```/g;

/** Every compilable TypeScript example in a README, with the line it starts on. */
export const typeScriptExamples = (markdown) => {
  const examples = [];
  for (const match of markdown.matchAll(FENCE)) {
    if (match[2].includes('fragment')) {
      continue;
    }
    examples.push({
      line: markdown.slice(0, match.index).split('\n').length,
      code: match[3],
    });
  }
  return examples;
};

/**
 * A throwaway project that resolves the package name to the staged declarations.
 *
 * `moduleResolution: bundler`, because `node10` resolution is deprecated in this
 * TypeScript and reports that rather than the example's own errors — which is how a
 * first attempt at this check came out green against code that does not compile.
 */
const project = (examples, types) => {
  const dir = mkdtempSync(join(tmpdir(), 'cee-readme-'));
  const stub = join(dir, 'node_modules', PACKAGE_NAME);
  mkdirSync(stub, { recursive: true });
  copyFileSync(types, join(stub, 'cedar-embeddable-editor.d.ts'));
  writeFileSync(
    join(stub, 'package.json'),
    JSON.stringify({ name: PACKAGE_NAME, version: '0.0.0', types: 'cedar-embeddable-editor.d.ts' }),
  );
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        types: [],
      },
    }),
  );
  // One file per example, named for the README line it came from, so a compiler
  // error points at the documentation rather than at a temporary directory.
  for (const { line, code } of examples) {
    writeFileSync(join(dir, `README-line-${line}.ts`), code);
  }
  return dir;
};

const run = () => {
  const readme = resolve(TARGET, 'README.md');
  const types = resolve(TARGET, 'cedar-embeddable-editor.d.ts');
  const examples = typeScriptExamples(readFileSync(readme, 'utf8'));
  if (examples.length === 0) {
    throw new Error(
      'no TypeScript examples found in the staged README.\n' +
        '  This check exists to compile them, so finding none means the fences moved.',
    );
  }

  const dir = project(examples, types);
  try {
    execFileSync(resolve(ROOT, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (error) {
    const output = (error.stdout ?? '') + (error.stderr ?? '');
    throw new Error(
      `a README TypeScript example does not compile against the shipped declarations.\n\n${output.trim()}\n\n` +
        '  Each file above is named for the README line its example starts on.',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return examples;
};

try {
  const examples = run();
  console.log(`  README types: ${examples.length} TypeScript example(s) compile against the shipped declarations`);
} catch (error) {
  console.error(`\n  README types: ${error.message ?? error}\n`);
  process.exit(1);
}
