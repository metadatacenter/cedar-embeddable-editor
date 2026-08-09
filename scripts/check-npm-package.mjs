import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertStagedPackage, readJson, ROOT } from './npm-package.mjs';

/**
 * The one version spot nothing derives and nothing else checks.
 *
 * `ceeVersion` comes from `package.json` and the staged manifest is generated
 * from the same field, so every other copy of the version agrees by
 * construction. `INNER_VERSION` is typed by hand into the editor component and
 * is only ever read by the line CEE logs on load — which means a bump that
 * forgets it produces a bundle that passes the whole gate and then tells anyone
 * reading the console that they are running the release before the one they
 * have.
 *
 * That has happened. It is worth one comparison here rather than a note in the
 * runbook asking people to remember.
 */
const STAMP_SOURCE = resolve(
  ROOT,
  'src/app/modules/shared/components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component.ts',
);

/**
 * Only the commit is compared, not the date.
 *
 * A dev version names the commit whose content ships and carries *that commit's*
 * date, so a bump commit's version names its parent. The stamp records when the
 * bump was written. The two dates are therefore expected to differ, and only the
 * commit identifies the same thing on both sides.
 */
const DEV_VERSION = /-dev\.\d{8}\.([0-9a-f]{7,40})$/;
const STAMP = /INNER_VERSION\s*=\s*'([^']*)'/;

const assertLoadTraceVersion = () => {
  const version = readJson(resolve(ROOT, 'package.json')).version;
  const declared = version.match(DEV_VERSION);
  if (!declared) {
    // A stable version carries no commit, so there is nothing to compare against.
    return `${version} (stable, no load-trace commit to check)`;
  }

  const stamped = readFileSync(STAMP_SOURCE, 'utf8').match(STAMP);
  if (!stamped) {
    throw new Error(
      `no INNER_VERSION found in ${STAMP_SOURCE.slice(ROOT.length + 1)}.\n` +
        '  The load trace is what a console reader uses to identify a build.',
    );
  }

  const stampedCommit = stamped[1].trim().split(/\s+/).pop();
  if (stampedCommit !== declared[1]) {
    throw new Error(
      `the load trace names a different build than the package.\n` +
        `  package.json:   ${version}\n` +
        `  INNER_VERSION:  ${stamped[1]}\n` +
        `  Set INNER_VERSION to '<YYYY-MM-DD HH:MM> ${declared[1]}' in\n` +
        `  ${STAMP_SOURCE.slice(ROOT.length + 1)}`,
    );
  }
  return `${stamped[1]}`;
};

try {
  const trace = assertLoadTraceVersion();
  const result = assertStagedPackage();
  console.log(
    `  npm package: ${result.version}, ${result.bytes.toLocaleString('en-US')} bytes, sha256 ${result.sha256}`,
  );
  console.log(`  load trace:  ${trace}`);
} catch (error) {
  console.error(`\n  npm package: ${error.message ?? error}\n`);
  process.exit(1);
}
