import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_BUNDLE = resolve(ROOT, 'visual/public/cedar-embeddable-editor.js');
export const SOURCE_MANIFEST = resolve(ROOT, 'visual/public/bundle-manifest.json');
/**
 * The published type declarations, emitted by `npm run types:public` from the one
 * self-contained source file. Regenerated on every stage rather than committed, so
 * it cannot describe an older contract than the bundle beside it.
 */
export const SOURCE_TYPES = resolve(ROOT, 'dist-types/cee-public-api.d.ts');
export const TARGET = resolve(ROOT, 'dist-npm/cedar-embeddable-editor');

export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export const packageMetadata = () => {
  const rootPackage = readJson(resolve(ROOT, 'package.json'));
  return {
    name: '@org.metadatacenter/cedar-embeddable-editor',
    version: rootPackage.version,
    description: rootPackage.description,
    main: 'cedar-embeddable-editor.js',
    // The bundle is a side-effecting script that registers a custom element, so it
    // exports nothing. `types` is what a host imports `CeeConfig` and friends from,
    // and it carries the `HTMLElementTagNameMap` entry that makes
    // `document.querySelector('cedar-embeddable-editor')` typed on its own.
    types: 'cedar-embeddable-editor.d.ts',
    files: [
      'cedar-embeddable-editor.js',
      'cedar-embeddable-editor.d.ts',
      'bundle-manifest.json',
      'README.md',
      'CHANGELOG.md',
    ],
    publishConfig: {
      registry: rootPackage.publishConfig.registry,
      tag: 'dev',
    },
    repository: {
      type: 'git',
      url: 'git+https://github.com/metadatacenter/cedar-embeddable-editor.git',
    },
    keywords: ['metadata', 'CEDAR', 'embeddable editor', 'Web Component'],
    author: 'Metadata Center',
    license: 'ISC',
    bugs: {
      url: 'https://github.com/metadatacenter/cedar-embeddable-editor/issues',
    },
    homepage: 'https://github.com/metadatacenter/cedar-embeddable-editor#readme',
  };
};

export const packageLock = () => {
  const metadata = packageMetadata();
  return {
    name: metadata.name,
    version: metadata.version,
    lockfileVersion: 2,
    requires: true,
    packages: {
      '': {
        name: metadata.name,
        version: metadata.version,
        license: metadata.license,
      },
    },
  };
};

export const assertSourceBundle = () => {
  if (!existsSync(SOURCE_BUNDLE) || !existsSync(SOURCE_MANIFEST)) {
    throw new Error('browser-tested bundle is missing. Run: npm run test:visual:prebuilt');
  }
  const bundle = readFileSync(SOURCE_BUNDLE);
  const manifest = readJson(SOURCE_MANIFEST);
  const digest = sha256(bundle);
  if (manifest.sha256 !== digest || manifest.bytes !== bundle.byteLength) {
    throw new Error('browser bundle does not match its manifest. Run: npm run test:visual:prebuilt');
  }
  return { bundle, manifest };
};

const readTypes = () => {
  if (!existsSync(SOURCE_TYPES)) {
    throw new Error('type declarations are not built. Run: npm run types:public');
  }
  return readFileSync(SOURCE_TYPES);
};

export const expectedFiles = () => ({
  'cedar-embeddable-editor.js': readFileSync(SOURCE_BUNDLE),
  'cedar-embeddable-editor.d.ts': readTypes(),
  'bundle-manifest.json': readFileSync(SOURCE_MANIFEST),
  'README.md': readFileSync(resolve(ROOT, 'README.md')),
  'CHANGELOG.md': readFileSync(resolve(ROOT, 'CHANGELOG.md')),
  'package.json': Buffer.from(`${JSON.stringify(packageMetadata(), null, 2)}\n`),
  'package-lock.json': Buffer.from(`${JSON.stringify(packageLock(), null, 2)}\n`),
});

export const assertStagedPackage = () => {
  const { manifest } = assertSourceBundle();
  if (!existsSync(TARGET)) {
    throw new Error('npm package is not staged. Run: npm run package:npm:prebuilt');
  }

  const expected = expectedFiles();
  const actualNames = readdirSync(TARGET).sort();
  const expectedNames = Object.keys(expected).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `staged package has unexpected contents\n  expected: ${expectedNames.join(', ')}\n  actual:   ${actualNames.join(', ')}`,
    );
  }

  for (const [name, bytes] of Object.entries(expected)) {
    if (!readFileSync(resolve(TARGET, name)).equals(bytes)) {
      throw new Error(`${name} differs from its verified source. Run: npm run package:npm:prebuilt`);
    }
  }

  return {
    bytes: manifest.bytes,
    sha256: manifest.sha256,
    version: packageMetadata().version,
  };
};
