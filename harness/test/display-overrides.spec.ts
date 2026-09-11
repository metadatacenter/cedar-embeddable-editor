import { describe, expect, it } from 'vitest';
import { CedarBuilders, CedarWriters } from 'cedar-model-typescript-library';
import { parse as parseYaml } from 'yaml';
import { ComponentDataService } from '@cee/service/component-data.service';
import { CeeDriver } from '../src/driver';

for (const format of ['JSON', 'YAML']) {
  describe(`${format} deployment display overrides`, () => {
    for (const override of [null, 'Display override', '']) {
      it(`renders ${JSON.stringify(override)} with artifact fallbacks only when absent`, () => {
        const field = CedarBuilders.textFieldBuilder()
          .withSchemaName('Artifact name')
          .withSchemaDescription('Artifact description')
          .withPreferredLabel('Semantic label')
          .build();
        const deployment = field.createDeploymentBuilder('field');
        if (override !== null) deployment.withLabel(override).withDescription(override);
        const template = CedarBuilders.templateBuilder().withAtId('urn:test:display').withSchemaName('Display').build();
        template.addChild(field, deployment.build());
        const document =
          format === 'JSON'
            ? CedarWriters.json().getStrict().getTemplateWriter().getAsJsonNode(template)
            : parseYaml(CedarWriters.yaml().getStrict().getTemplateWriter().getAsYamlString(template));
        const component = new CeeDriver(document).findOrThrow(['field']);

        expect(new ComponentDataService().getRenderingLabelForComponent(component)).toBe(override ?? 'Semantic label');
        expect(component.labelInfo.description).toBe(override ?? 'Artifact description');
        expect(component.labelInfo.preferredLabel).toBe('Semantic label');
        expect(component.labelInfo.label).toBe('Artifact name');
      });
    }
  });
}
