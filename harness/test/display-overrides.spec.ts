import { describe, expect, it } from 'vitest';
import { CedarBuilders, CedarWriters } from 'cedar-model-typescript-library';
import { parse as parseYaml } from 'yaml';
import { ComponentDataService } from '@cee/service/component-data.service';
import type { CedarComponent } from '@cee/models/component/cedar-component.model';
import { SingleFieldComponent } from '@cee/models/field/single-field-component.model';
import { CeeDriver } from '../src/driver';

/**
 * The property key, which identifies the child inside its parent and inside every instance the
 * parent produces. It is not a label: production templates key fields `lab_id` and `dataset_type`
 * and put the legible name in `skos:prefLabel`.
 */
const KEY = 'lab_id';

interface Artifact {
  name: string;
  description?: string;
  preferredLabel?: string;
}

/** What the parent says about this use of the artifact, which CEDAR stores in `_ui`. */
interface Deployment {
  label?: string;
  description?: string;
}

function childOf(format: string, artifact: Artifact, deployment: Deployment = {}): CedarComponent {
  const fieldBuilder = CedarBuilders.textFieldBuilder().withSchemaName(artifact.name);
  if (artifact.description !== undefined) {
    fieldBuilder.withSchemaDescription(artifact.description);
  }
  if (artifact.preferredLabel !== undefined) {
    fieldBuilder.withPreferredLabel(artifact.preferredLabel);
  }
  const field = fieldBuilder.build();

  const deploymentBuilder = field.createDeploymentBuilder(KEY);
  if (deployment.label !== undefined) {
    deploymentBuilder.withLabel(deployment.label);
  }
  if (deployment.description !== undefined) {
    deploymentBuilder.withDescription(deployment.description);
  }

  const template = CedarBuilders.templateBuilder().withAtId('urn:test:display').withSchemaName('Display').build();
  template.addChild(field, deploymentBuilder.build());

  const document =
    format === 'JSON'
      ? CedarWriters.json().getStrict().getTemplateWriter().getAsJsonNode(template)
      : parseYaml(CedarWriters.yaml().getStrict().getTemplateWriter().getAsYamlString(template));
  return new CeeDriver(document).findOrThrow([KEY]);
}

function rendered(component: CedarComponent): string {
  return new ComponentDataService().getRenderingLabelForComponent(component);
}

describe('a child that names itself nowhere', () => {
  it('falls back to the property key, the one name every child has', () => {
    const component = new SingleFieldComponent();
    component.name = KEY;

    expect(rendered(component)).toBe(KEY);
  });
});

for (const format of ['JSON', 'YAML']) {
  describe(`${format} display labels`, () => {
    it('shows a parent override ahead of the artifact', () => {
      const component = childOf(
        format,
        { name: 'Artifact name', description: 'Artifact description', preferredLabel: 'Semantic label' },
        { label: 'Display override', description: 'Deployment description' },
      );

      expect(rendered(component)).toBe('Display override');
      expect(component.labelInfo.description).toBe('Deployment description');
      expect(component.labelInfo.preferredLabel).toBe('Semantic label');
      expect(component.labelInfo.label).toBe('Artifact name');
    });

    it('keeps an override the author cleared', () => {
      const component = childOf(
        format,
        { name: 'Artifact name', description: 'Artifact description', preferredLabel: 'Semantic label' },
        { label: '', description: '' },
      );

      expect(rendered(component)).toBe('');
      expect(component.labelInfo.description).toBe('');
    });

    it('shows the preferred label where the parent declares nothing', () => {
      const component = childOf(format, {
        name: 'Artifact name',
        description: 'Artifact description',
        preferredLabel: 'Semantic label',
      });

      expect(rendered(component)).toBe('Semantic label');
      expect(component.labelInfo.deploymentLabel).toBeNull();
      expect(component.labelInfo.description).toBe('Artifact description');
    });

    it('falls back to the artifact name where there is no preferred label', () => {
      const component = childOf(format, { name: 'Artifact name', description: 'Artifact description' });

      expect(rendered(component)).toBe('Artifact name');
    });

    // The production shape: one authoring pipeline named the field for the key, so `schema:name`,
    // the key and the `_ui.propertyLabels` entry are the same string and `skos:prefLabel` carries
    // the only name written for a reader.
    it('ignores an entry repeating the key, and shows the preferred label instead', () => {
      const component = childOf(format, { name: KEY, preferredLabel: 'Lab ID' }, { label: KEY });

      expect(rendered(component)).toBe('Lab ID');
      expect(component.labelInfo.deploymentLabel).toBeNull();
      expect(component.labelInfo.label).toBe(KEY);
    });

    // The same entry, in a template whose field is named for a reader: what the parent holds is the
    // key either way, so it is the key CEE drops rather than a repetition of the name.
    it('ignores an entry repeating the key where the artifact is named differently', () => {
      const component = childOf(format, { name: 'Lab identifier', preferredLabel: 'Lab ID' }, { label: KEY });

      expect(rendered(component)).toBe('Lab ID');
      expect(component.labelInfo.deploymentLabel).toBeNull();
    });

    // The YAML shape: the writers emit an entry only where it differs from the artifact's own name,
    // so a reader restores the name wherever the document overrode nothing. An entry repeating the
    // name therefore says no more than an absent one, in either serialization.
    it('ignores an entry repeating the artifact name, and shows the preferred label instead', () => {
      const component = childOf(
        format,
        { name: 'Artifact name', preferredLabel: 'Semantic label' },
        { label: 'Artifact name' },
      );

      expect(rendered(component)).toBe('Semantic label');
      expect(component.labelInfo.deploymentLabel).toBeNull();
      expect(component.labelInfo.label).toBe('Artifact name');
    });
  });

  describe(`${format} display descriptions`, () => {
    it('ignores an entry repeating the key', () => {
      const component = childOf(
        format,
        { name: 'Artifact name', description: 'Artifact description' },
        {
          description: KEY,
        },
      );

      expect(component.labelInfo.description).toBe('Artifact description');
    });

    it('ignores the placeholder the Template Designer writes for a blank description', () => {
      const component = childOf(
        format,
        { name: 'Artifact name', description: 'Artifact description' },
        {
          description: 'Help Text',
        },
      );

      expect(component.labelInfo.description).toBe('Artifact description');
    });

    it('leaves no description where the artifact carries the placeholder', () => {
      const component = childOf(format, { name: 'Artifact name', description: 'Help Text' });

      expect(component.labelInfo.description).toBeNull();
    });
  });
}
