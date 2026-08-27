import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { packageMetadata } from './npm-package.mjs';


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
