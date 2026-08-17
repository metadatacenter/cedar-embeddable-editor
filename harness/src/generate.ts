/**
 * Template generation, driven by the CEDAR Model TypeScript Library.
 *
 * Everything here is deterministic: fixed IRIs, fixed timestamps, no randomness,
 * so the only nondeterminism in a test run comes from the code under test rather
 * than from the fixtures. CEE used to supply some of its own, minting a random
 * `@id` into every element occurrence it built; it mints nothing now, and two
 * builds of one template are the same document.
 */
import { CedarBuilders, CedarWriters } from 'cedar-model-typescript-library';
import { parse as parseYaml } from 'yaml';
import { Cardinality, FieldKind, Nesting } from './axes';

const FIXED_DATE = '2026-01-01T00:00:00-08:00';
const USER = 'https://metadatacenter.org/users/00000000-0000-0000-0000-000000000001';

/** Deterministic pseudo-GUID so generated templates are byte-stable. */
const id = (seed: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-${hex}00000000`.slice(0, 36);
};

/**
 * Call a builder method only if this builder variant has it.
 *
 * The library models CEE's cardinality rules in the type system: radio and
 * single-choice lists get a `ChildDeploymentInfoAlwaysSingleBuilder`, checkbox
 * and multi-choice get `...AlwaysMultipleBuilder`, statics get
 * `...StaticBuilder`, and only the plain `ChildDeploymentInfoBuilder` exposes
 * `withMultiInstance`. Rather than duplicate that classification here (and
 * have it rot), probe for the method.
 */
const opt = (builder: any, method: string, ...args: unknown[]): any => {
  if (typeof builder?.[method] === 'function') {
    return builder[method](...args);
  }
  return builder;
};

/** True when this field kind can actually be deployed as multi-instance. */
export const supportsMultiInstance = (kind: FieldKind): boolean => {
  const probe = kind.make().withTitle('probe').withSchemaName('probe').build();
  const db = probe.createDeploymentBuilder('_probe');
  return typeof db?.withMultiInstance === 'function';
};

const buildField = (kind: FieldKind, name: string, size?: { width: number; height: number }) => {
  let b = kind
    .make()
    .withAtId(`https://repo.metadatacenter.org/template-fields/${id(name)}`)
    .withTitle(`${kind.key} title`)
    .withDescription(`${kind.key} description`)
    .withSchemaName(`${kind.key} schema name`)
    .withCreatedOn(FIXED_DATE)
    .withCreatedBy(USER)
    .withLastUpdatedOn(FIXED_DATE)
    .withModifiedBy(USER);
  if (kind.configure) b = kind.configure(b);
  if (size) {
    b = opt(b, 'withWidth', size.width);
    b = opt(b, 'withHeight', size.height);
  }
  return b.build();
};

export interface ChildSpec {
  kind: FieldKind;
  /** Property name in the template (without the leading underscore). */
  name: string;
  cardinality?: Cardinality;
  required?: boolean;
  hidden?: boolean;
  minItems?: number;
  maxItems?: number;
  /**
   * `_ui._size`, which only the two sizeable static kinds carry.
   *
   * Probed like everything else here rather than branched on: the library models
   * `withWidth` and `withHeight` on the image and YouTube builders and nowhere
   * else, so asking for a size on a text field silently does nothing, which is
   * also what the template would mean.
   */
  size?: { width: number; height: number };
}

const deploy = (artifact: any, spec: ChildSpec) => {
  const propName = `_${spec.name}`;
  // Every one of these is probed rather than called directly. Static fields get
  // a `ChildDeploymentInfoStaticBuilder`, which extends only the *abstract*
  // base — `withIri` and the multi-instance methods live on the *dynamic*
  // subclass and simply do not exist for statics.
  let db = artifact.createDeploymentBuilder(propName);
  db = opt(db, 'withIri', `https://schema.metadatacenter.org/properties/${id(propName)}`);
  db = opt(db, 'withLabel', `${spec.name} label`);
  db = opt(db, 'withDescription', `${spec.name} property description`);

  if (spec.cardinality === 'multi') {
    db = opt(db, 'withMultiInstance', true);
    db = opt(db, 'withMinItems', spec.minItems ?? 1);
    db = opt(db, 'withMaxItems', spec.maxItems ?? 5);
  }
  if (spec.required) db = opt(db, 'withRequiredValue', true);
  if (spec.hidden) db = opt(db, 'withHidden', true);

  return { propName, deployment: db.build() };
};

export interface ElementSpec {
  name: string;
  cardinality?: Cardinality;
  minItems?: number;
  maxItems?: number;
  children?: ChildSpec[];
  /** Nested elements. Recursion here is what produces multi-inside-multi. */
  elements?: ElementSpec[];
}

/**
 * Build a template element containing the given children and sub-elements.
 *
 * Nesting matters because path resolution consults `currentIndex` at *every*
 * multi ancestor (`DataObjectStructureHandler.getDataPathNodeRecursively`). A
 * field two multi-elements deep is resolved through two independent cursors,
 * and nothing in the single-level fixtures exercises that.
 */
const buildElement = (spec: ElementSpec) => {
  let eb = CedarBuilders.templateElementBuilder()
    .withAtId(`https://repo.metadatacenter.org/template-elements/${id(spec.name)}`)
    .withTitle(`${spec.name} title`)
    .withDescription(`${spec.name} description`)
    .withSchemaName(spec.name)
    .withCreatedOn(FIXED_DATE)
    .withCreatedBy(USER)
    .withLastUpdatedOn(FIXED_DATE)
    .withModifiedBy(USER);

  // Optional, like `elements` below: an element holding nothing but
  // sub-elements is a shape real templates use.
  for (const child of spec.children ?? []) {
    const field = buildField(child.kind, child.name, child.size);
    const { deployment } = deploy(field, child);
    eb = eb.addChild(field, deployment);
  }

  for (const sub of spec.elements ?? []) {
    const element = buildElement(sub);
    const { deployment } = deploy(element, {
      kind: null as unknown as FieldKind,
      name: sub.name,
      cardinality: sub.cardinality,
      minItems: sub.minItems,
      maxItems: sub.maxItems,
    });
    eb = eb.addChild(element, deployment);
  }

  return eb.build();
};

export interface TemplateSpec {
  name: string;
  /** Children placed directly on the template. */
  children?: ChildSpec[];
  /** Elements placed on the template, each with their own children. */
  elements?: ElementSpec[];
}

/**
 * The library's `Template` model for this spec, before any serialization.
 *
 * Kept separate from the renderers so a single generated template can be written
 * down as JSON *and* as YAML — the two serializations of the one model that
 * `format-independence` holds CEE to.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const buildTemplateModel = (spec: TemplateSpec): any => {
  let tb = CedarBuilders.templateBuilder()
    .withAtId(`https://repo.metadatacenter.org/templates/${id(spec.name)}`)
    .withTitle(`${spec.name} title`)
    .withDescription(`${spec.name} description`)
    .withSchemaName(spec.name)
    .withSchemaDescription(`${spec.name} schema description`)
    .withCreatedOn(FIXED_DATE)
    .withCreatedBy(USER)
    .withLastUpdatedOn(FIXED_DATE)
    .withModifiedBy(USER);

  for (const child of spec.children ?? []) {
    const field = buildField(child.kind, child.name, child.size);
    const { deployment } = deploy(field, child);
    tb = tb.addChild(field, deployment);
  }

  for (const el of spec.elements ?? []) {
    const element = buildElement(el);
    const { deployment } = deploy(element, {
      kind: null as unknown as FieldKind,
      name: el.name,
      cardinality: el.cardinality,
      minItems: el.minItems,
      maxItems: el.maxItems,
    });
    tb = tb.addChild(element, deployment);
  }

  return tb.build();
};

/** Assemble a full CEDAR template as a plain JSON object CEE can consume. */
export const buildTemplate = (spec: TemplateSpec): object => {
  const writer = CedarWriters.json().getStrict().getTemplateWriter();
  // Round through JSON so CEE receives a plain object, exactly as it would
  // from an HTTP response or a host-page injection.
  return JSON.parse(JSON.stringify(writer.getAsJsonNode(buildTemplateModel(spec))));
};

/**
 * The same template, written down as YAML and parsed back to a plain object.
 *
 * The YAML *text* is produced by the library's YAML writer — the same one CEE
 * emits with — so this is not a JSON object relabelled but the genuine YAML
 * serialization. `parse` only turns that text into the object
 * `YamlTemplateParser`/`CedarReaders.yaml()` expect, exactly as `JSON.parse`
 * does for the JSON side. No structural manipulation happens here.
 */
export const buildTemplateYaml = (spec: TemplateSpec): object => {
  const yaml = CedarWriters.yaml().getStrict().getTemplateWriter().getAsYamlString(buildTemplateModel(spec));
  return parseYaml(yaml) as object;
};

/**
 * The cross-product sweep: every field kind × cardinality × nesting position.
 *
 * Skips multi where the library says the field can't be multi-instance, rather
 * than generating templates CEDAR itself considers invalid.
 */
export interface Case {
  label: string;
  kind: FieldKind;
  cardinality: Cardinality;
  nesting: Nesting;
  /** Path to the field inside the built template. */
  path: string[];
  template: object;
}

export const sweep = (
  kinds: FieldKind[],
  cardinalities: readonly Cardinality[],
  nestings: readonly Nesting[],
): Case[] => {
  const cases: Case[] = [];

  for (const kind of kinds) {
    const canMulti = supportsMultiInstance(kind);

    for (const cardinality of cardinalities) {
      if (cardinality === 'multi' && !canMulti) continue;

      for (const nesting of nestings) {
        const fieldName = `${kind.key}_${cardinality}`;
        const child: ChildSpec = { kind, name: fieldName, cardinality };
        const label = `${kind.inputType}/${cardinality}/${nesting}`;
        let template: object;
        let path: string[];

        if (nesting === 'root') {
          template = buildTemplate({ name: `t_${kind.key}_${cardinality}_root`, children: [child] });
          path = [`_${fieldName}`];
        } else {
          const elMulti = nesting === 'inMultiElement';
          const elName = elMulti ? 'multi_el' : 'single_el';
          template = buildTemplate({
            name: `t_${kind.key}_${cardinality}_${elName}`,
            elements: [
              {
                name: elName,
                cardinality: elMulti ? 'multi' : ('single' as Cardinality),
                minItems: elMulti ? 2 : undefined,
                children: [child],
              },
            ],
          });
          path = [`_${elName}`, `_${fieldName}`];
        }

        cases.push({ label, kind, cardinality, nesting, path, template });
      }
    }
  }

  return cases;
};
