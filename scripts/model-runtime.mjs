/** Runtime identity across public and train package names. Keep code and resolver metadata exact. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

export function modelRuntimeSha256(dir) {
  const metadata = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
  const normalized = { ...metadata };
  delete normalized.name;
  delete normalized.version;
  delete normalized.publishConfig;
  const hash = createHash('sha256');
  function visit(path) {
    const name = relative(dir, path);
    hash.update(name + '\0');
    if (statSync(path).isDirectory()) for (const child of readdirSync(path).sort()) visit(resolve(path, child));
    else hash.update(name === 'package.json' ? JSON.stringify(canonical(normalized)) : readFileSync(path));
    hash.update('\0');
  }
  visit(resolve(dir, 'package.json'));
  visit(resolve(dir, existsSync(resolve(dir, 'esm')) ? 'esm' : metadata.module));
  return hash.digest('hex');
}
