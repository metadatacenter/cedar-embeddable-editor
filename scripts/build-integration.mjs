/** AOT-compiled, host-fonts modules for a coordinated host build. The public script stays standalone. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { modelRuntimeSha256 } from './model-runtime.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist/integration');
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const shared = (name) =>
  name.startsWith('@angular/') ||
  ['@ngx-translate/core', 'rxjs', 'tslib', 'zone.js', 'cedar-model-typescript-library'].includes(name);
function fingerprint(base, paths) {
  const hash = createHash('sha256');
  function visit(path) {
    hash.update(relative(base, path) + '\0');
    if (!existsSync(path)) {
      hash.update('missing\0');
      return;
    }
    if (statSync(path).isDirectory()) for (const name of readdirSync(path).sort()) visit(resolve(path, name));
    else hash.update(readFileSync(path));
    hash.update('\0');
  }
  for (const path of paths) visit(resolve(base, path));
  return hash.digest('hex');
}
function runtimes() {
  return Object.fromEntries(
    Object.keys(json(resolve(root, 'package.json')).dependencies)
      .filter(shared)
      .sort()
      .map((name) => {
        const dir = resolve(root, 'node_modules', name),
          metadata = json(resolve(dir, 'package.json'));
        return [
          name,
          {
            version: metadata.version,
            ...(name === 'cedar-model-typescript-library'
              ? {
                  sha256: fingerprint(dir, ['package.json', existsSync(resolve(dir, 'esm')) ? 'esm' : metadata.module]),
                  runtimeSha256: modelRuntimeSha256(dir),
                }
              : {}),
          },
        ];
      }),
  );
}
function source() {
  return fingerprint(root, [
    'src',
    'scripts',
    ...readdirSync(root)
      .filter((name) => /^(package(-lock)?\.json|angular\.json|tsconfig.*\.json|\.postcssrc\.json)$/.test(name))
      .sort(),
    'node_modules/@org.metadatacenter/cedar-design-tokens',
  ]);
}
const names = ['integration.mjs', 'integration-manifest.json', 'integration-licenses.txt'];
export function integrationFiles() {
  const manifest = json(resolve(output, 'integration-manifest.json'));
  const bytes = readFileSync(resolve(output, 'integration.mjs'));
  if (
    manifest.source !== source() ||
    JSON.stringify(manifest.runtimes) !== JSON.stringify(runtimes()) ||
    manifest.sha256 !== sha256(bytes) ||
    manifest.bytes !== bytes.length
  )
    throw new Error('Integration modules are stale or modified. Rebuild the production package.');
  return Object.fromEntries(names.map((name) => [name, readFileSync(resolve(output, name))]));
}
async function main() {
  const before = source(),
    runtime = runtimes();
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, 'node_modules/@angular/cli/bin/ng.js'),
      'build',
      '--configuration=production,host-fonts,integration',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.status !== 0) throw result.error || new Error('Integration compilation failed');
  const external = json(resolve(root, 'angular.json')).projects[json(resolve(root, 'package.json')).name].architect
    .build.configurations.integration.externalDependencies;
  const bundled = await build({
    entryPoints: [resolve(output, 'browser/main.js')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    external,
    write: false,
    legalComments: 'inline',
  });
  const bytes = bundled.outputFiles[0].contents;
  if (before !== source() || JSON.stringify(runtime) !== JSON.stringify(runtimes()))
    throw new Error('Integration inputs changed during compilation');
  writeFileSync(resolve(output, 'integration.mjs'), bytes);
  writeFileSync(
    resolve(output, 'integration-manifest.json'),
    JSON.stringify(
      {
        format: 'cedar-integration',
        version: 1,
        source: before,
        bytes: bytes.length,
        sha256: sha256(bytes),
        runtimes: runtime,
      },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(resolve(output, 'integration-licenses.txt'), readFileSync(resolve(output, '3rdpartylicenses.txt')));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
