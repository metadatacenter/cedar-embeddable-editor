import { describe, expect, it } from 'vitest';
import { DataContext } from '../../src/app/modules/shared/util/data-context';
import { HandlerContext } from '../../src/app/modules/shared/util/handler-context';
import { IriPrefix } from '../../src/app/modules/shared/util/iri-prefix';
import type { InstanceObject } from '@cee/models/instance-node.model';
import { JsonSchema } from 'cedar-model-typescript-library';

const messages = {
  trace: (): void => undefined,
  error: (): void => undefined,
};

describe('editor-instance configuration isolation', () => {
  it('keeps host-configurable link prefixes on separate instances', () => {
    const first = new IriPrefix();
    const second = new IriPrefix();

    first.setBioPortalPrefix('https://first.example/bioportal/');
    second.setBioPortalPrefix('https://second.example/bioportal/');
    first.setOrcidPrefix('https://first.example/orcid/');
    second.setRorPrefix('https://second.example/ror/');

    expect(first.getBioPortalPrefix()).toBe('https://first.example/bioportal/');
    expect(second.getBioPortalPrefix()).toBe('https://second.example/bioportal/');
    expect(first.getOrcidPrefix()).toBe('https://first.example/orcid/');
    expect(second.getRorPrefix()).toBe('https://second.example/ror/');
  });

  it('mints element IDs from the owning handler context after another editor is configured', () => {
    const firstPrefix = new IriPrefix();
    const secondPrefix = new IriPrefix();
    const first = new HandlerContext(new DataContext(), messages as any, () => firstPrefix.get());
    const second = new HandlerContext(new DataContext(), messages as any, () => secondPrefix.get());

    firstPrefix.set('https://first.example/');
    secondPrefix.set('https://second.example/');

    const firstElement: InstanceObject = {};
    const secondElement: InstanceObject = {};
    // Build from the first context only after the second editor has changed its
    // configuration. A static prefix made both IDs use the second value.
    second.dataObjectBuilderService.addRandomAtId(secondElement);
    first.dataObjectBuilderService.addRandomAtId(firstElement);

    expect(firstElement[JsonSchema.atId]).toMatch(/^https:\/\/first\.example\/template-element-instances\//);
    expect(secondElement[JsonSchema.atId]).toMatch(/^https:\/\/second\.example\/template-element-instances\//);
  });
});
