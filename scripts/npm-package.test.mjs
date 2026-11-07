import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

import { packageMetadata } from './npm-package.mjs';

it('the integration build preserves every hosted style replacement while deferring RDF', () => {
  const angular = JSON.parse(readFileSync(new URL('../angular.json', import.meta.url), 'utf8'));
  const configurations = angular.projects['cedar-embeddable-editor'].architect.build.configurations;
  for (const replacement of configurations['host-fonts'].fileReplacements)
    assert.ok(
      configurations.integration.fileReplacements.some(
        (candidate) => candidate.replace === replacement.replace && candidate.with === replacement.with,
      ),
    );
  assert.ok(
    configurations.integration.fileReplacements.some(
      (candidate) =>
        candidate.replace.endsWith('/rdf-runtime.ts') && candidate.with.endsWith('/rdf-runtime.integration.ts'),
    ),
  );
});

const source = (version) => ({
  version,
  description: 'A reusable Web Component for creating and editing CEDAR metadata instances.',
});

describe('published CEE channel identity', () => {
  it('stages a stable version unscoped for npmjs', () => {
    const metadata = packageMetadata(source('2.0.2'));
    assert.equal(metadata.name, 'cedar-embeddable-editor');
    assert.equal(metadata.version, '2.0.2');
    assert.equal(metadata.publishConfig, undefined);
  });

  it('stages a development version scoped for Nexus under the dev tag', () => {
    const metadata = packageMetadata(source('2.0.3-dev.20260827.ab718c8'));
    assert.equal(metadata.name, '@org.metadatacenter/cedar-embeddable-editor');
    assert.deepEqual(metadata.publishConfig, {
      registry: 'https://nexus.bmir.stanford.edu/repository/npm-cedar/',
      tag: 'dev',
    });
  });

  it('treats a train-owned development version as the Nexus channel', () => {
    const metadata = packageMetadata(source('2.0.3-dev.20260827.1711.gab718c87781a'));
    assert.equal(metadata.name, '@org.metadatacenter/cedar-embeddable-editor');
    assert.equal(metadata.version, '2.0.3-dev.20260827.1711.gab718c87781a');
    assert.equal(metadata.publishConfig.tag, 'dev');
  });
});

it('ships both font variants while retaining the standalone default', () => {
  const metadata = packageMetadata(source('2.0.16'));
  assert.equal(metadata.main, 'cedar-embeddable-editor.js');
  assert.ok(metadata.files.includes('cedar-embeddable-editor.host-fonts.js'));
  assert.ok(metadata.files.includes('bundle-manifest.host-fonts.json'));
});
