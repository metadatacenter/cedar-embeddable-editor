import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertSourceBundle, expectedFiles, TARGET } from './npm-package.mjs';

const { manifest } = assertSourceBundle();
mkdirSync(TARGET, { recursive: true });
for (const [name, bytes] of Object.entries(expectedFiles())) {
  writeFileSync(resolve(TARGET, name), bytes);
}

console.log(
  `  npm package: staged ${manifest.bytes.toLocaleString('en-US')} bytes (${manifest.sha256})`,
);
