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

/**
 * The rule, enumerated over the axes it branches on, and asserted against both serialisations.
 *
 * The cases above each pin one situation. This pins the rule itself: for every combination of
 * what the child is named, whether it carries a `skos:prefLabel`, and what the parent holds for
 * it, the label a reader sees is stated here independently of the parser that produces it, and
 * the two serialisations have to agree on it.
 *
 * The corpus cannot do this job. A divergence needs one child whose property key, `schema:name`
 * and `skos:prefLabel` are three different strings, and neither fixture corpus has one: the
 * numbered templates name a field for a reader and repeat that name in `_ui.propertyLabels`,
 * while HuBMAP names every field for its key, so the key test catches it there. Both corpora
 * pass whether or not the rule is right, which is exactly why this is written out by hand.
 */
describe('the display label rule', () => {
  /** What the artifact calls itself. */
  const NAMES = [
    { title: 'named for its key', value: KEY },
    { title: 'named for a reader', value: 'Artifact name' },
  ];

  /** The semantic label, which most fields do not carry. */
  const PREFERRED = [
    { title: 'no preferred label', value: undefined },
    { title: 'a preferred label', value: 'Semantic label' },
  ];

  /** What the parent holds for this child, resolved against the name so "repeats it" is exact. */
  const ENTRIES = [
    { title: 'no entry', value: () => undefined },
    { title: 'an entry repeating the key', value: () => KEY },
    { title: 'an entry repeating the artifact name', value: (name: string) => name },
    { title: 'a real override', value: () => 'Display override' },
    { title: 'an override the author cleared', value: () => '' },
  ];

  /**
   * The rule as stated, not as implemented: an entry the parent holds is an override only where
   * it differs from both the property key and the artifact's own name, and a label then resolves
   * override, `skos:prefLabel`, `schema:name`, key.
   */
  const expected = (name: string, preferredLabel: string | undefined, entry: string | undefined): string => {
    const override = entry !== undefined && entry !== KEY && entry !== name;
    return override ? entry! : (preferredLabel ?? name ?? KEY);
  };

  for (const named of NAMES) {
    for (const preferred of PREFERRED) {
      for (const held of ENTRIES) {
        const entry = held.value(named.value);
        const want = expected(named.value, preferred.value, entry);
        it(`${named.title}, ${preferred.title}, ${held.title}: shows "${want}" in both serialisations`, () => {
          const artifact = { name: named.value, preferredLabel: preferred.value };
          const deployment = entry === undefined ? {} : { label: entry };

          const viaJson = rendered(childOf('JSON', artifact, deployment));
          const viaYaml = rendered(childOf('YAML', artifact, deployment));

          expect(viaJson, 'the JSON reading does not follow the rule').toBe(want);
          expect(viaYaml, 'the YAML reading disagrees with the JSON reading').toBe(viaJson);
        });
      }
    }
  }
});

/**
 * An element child is read by the same code, and nothing else here proves it.
 *
 * `ModelLibraryTemplateParser.extractLabels` serves fields, elements and static fields alike, so
 * an element's label resolves through the same chain and its parent's entry is narrowed by the
 * same test. Asserted on `deploymentLabel` rather than the rendered string because the element
 * builder has no `withPreferredLabel` — `TemplateElement` carries `skos:prefLabel` and the library
 * offers no way to set it — so the rendered label falls to `schema:name` whether the entry was
 * read as an override or not, and only the override itself distinguishes the two.
 */
for (const format of ['JSON', 'YAML']) {
  describe(`${format} element children`, () => {
    const NAME = 'Address block';
    const elementChildOf = (deployment: Deployment = {}): CedarComponent => {
      const element = CedarBuilders.templateElementBuilder()
        .withAtId('https://repo.metadatacenter.org/template-elements/display')
        .withSchemaName(NAME)
        .build();

      const deploymentBuilder = element.createDeploymentBuilder(KEY);
      if (deployment.label !== undefined) {
        deploymentBuilder.withLabel(deployment.label);
      }

      const template = CedarBuilders.templateBuilder().withAtId('urn:test:display').withSchemaName('Display').build();
      template.addChild(element, deploymentBuilder.build());

      const document =
        format === 'JSON'
          ? CedarWriters.json().getStrict().getTemplateWriter().getAsJsonNode(template)
          : parseYaml(CedarWriters.yaml().getStrict().getTemplateWriter().getAsYamlString(template));
      return new CeeDriver(document).findOrThrow([KEY]);
    };

    it('takes a real override from its parent', () => {
      const element = elementChildOf({ label: 'Display override' });

      expect(rendered(element)).toBe('Display override');
      expect(element.labelInfo.deploymentLabel).toBe('Display override');
    });

    it('reads an entry repeating the key as no override', () => {
      const element = elementChildOf({ label: KEY });

      expect(element.labelInfo.deploymentLabel).toBeNull();
      expect(rendered(element)).toBe(NAME);
    });

    it('reads an entry repeating its own name as no override', () => {
      const element = elementChildOf({ label: NAME });

      expect(element.labelInfo.deploymentLabel).toBeNull();
      expect(rendered(element)).toBe(NAME);
    });

    it('carries no override where the parent declares nothing', () => {
      const element = elementChildOf();

      expect(element.labelInfo.deploymentLabel).toBeNull();
      expect(rendered(element)).toBe(NAME);
    });
  });
}
