/**
 * Templates that contradict themselves.
 *
 * A CEDAR field says what it holds twice: `_ui.inputType` with
 * `_valueConstraints` describe it for an editor, and the field's own JSON Schema
 * `properties` block describes it for a validator. Those two have to agree, and
 * nothing in the template format makes them.
 *
 * This matters for reading the conformance count honestly. When CEE's output
 * fails to validate, the question is whether CEE wrote the wrong thing or the
 * template asked for something impossible — and that is answerable, not a
 * judgement call, so it should be answered here rather than argued about in a
 * comment.
 */
import { describe, expect, it } from 'vitest';
import { corpusAvailable, corpusTemplates } from '../src/corpus';

interface ChoiceField {
  template: string;
  path: string;
  inputType: string;
  hasLiterals: boolean;
  allowsAtValue: boolean;
  allowsIri: boolean;
}

/**
 * Every field whose value comes from a fixed list of literals — list, radio,
 * checkbox — with what its schema actually permits in an instance.
 */
const collectChoiceFields = (): ChoiceField[] => {
  const found: ChoiceField[] = [];

  const walk = (node: unknown, templateId: string, path: string): void => {
    if (node === null || typeof node !== 'object') {
      return;
    }
    const properties = (node as Record<string, unknown>).properties;
    if (properties === null || typeof properties !== 'object') {
      return;
    }
    for (const [key, raw] of Object.entries(properties as Record<string, unknown>)) {
      if (raw === null || typeof raw !== 'object') {
        continue;
      }
      // A multi field wraps its schema in `items`.
      const field = ((raw as Record<string, unknown>).items ?? raw) as Record<string, unknown>;
      const ui = (field._ui ?? {}) as Record<string, unknown>;
      const constraints = (field._valueConstraints ?? {}) as Record<string, unknown>;
      const inputType = ui.inputType as string;
      const own = field.properties as Record<string, unknown> | undefined;

      if (['list', 'radio', 'checkbox'].includes(inputType) && own && typeof own === 'object') {
        found.push({
          template: templateId,
          path: `${path}${key}`,
          inputType,
          hasLiterals: Array.isArray(constraints.literals) && constraints.literals.length > 0,
          allowsAtValue: Object.hasOwn(own, '@value'),
          allowsIri: Object.hasOwn(own, '@id'),
        });
      }
      walk(field, templateId, `${path}${key}/`);
    }
  };

  for (const artifact of corpusTemplates()) {
    walk(artifact.json, artifact.id, '');
  }
  return found;
};

const choiceFields = corpusAvailable() ? collectChoiceFields() : [];

/**
 * The four fields in `template-029` that cannot hold any of their own values.
 *
 * Each declares `_ui.inputType: list` with a list of `literals` — plain strings,
 * no ontologies, classes, branches or value sets — and each declares its
 * instance schema as `{@type, @id, rdfs:label}` with `additionalProperties:
 * false`. So the field offers only literals to choose from and permits only an
 * IRI to be stored. No instance can satisfy it.
 *
 * The canonical `literal-field-meta-schema.json` in
 * `cedar-model-validation-library` allows a literal field's `properties` to
 * carry `@value` and requires only `@type`, so the template is meta-schema
 * valid; it is the two halves of the *same* field disagreeing that makes it
 * unsatisfiable. That is a template defect of the same family as `template-003`,
 * and not something CEE can write its way out of.
 */
const CONTRADICTORY = [
  '029:Data File Description/Description Language',
  '029:Data File Language/Primary Language',
  '029:Data File Language/Other Language',
  '029:Data File Title/Language',
];

describe.skipIf(!corpusAvailable())('a choice field permits the values it offers', () => {
  it('there are choice fields to check', () => {
    expect(choiceFields.length).toBeGreaterThan(5);
  });

  /**
   * The claim being pinned: CEE writing `{'@value': label}` for a literal choice
   * field is right everywhere the template is consistent. Eleven such fields
   * exist across the 37 templates and seven agree with CEE; the four that do not
   * are all in one template and all contradict themselves.
   */
  it.each(choiceFields.filter((f) => f.hasLiterals).map((f) => [`${f.template}:${f.path}`, f] as const))(
    '%s',
    (id, field) => {
      if (CONTRADICTORY.includes(id)) {
        expect(field.allowsAtValue, `${id} is recorded as contradictory but now permits @value`).toBe(false);
        expect(field.allowsIri, 'and its schema permits only an IRI').toBe(true);
        return;
      }
      expect(field.allowsAtValue, `${id} offers literals but its schema forbids @value`).toBe(true);
    },
  );

  it('only template-029 contradicts itself', () => {
    const contradictory = choiceFields
      .filter((f) => f.hasLiterals && !f.allowsAtValue)
      .map((f) => `${f.template}:${f.path}`);
    expect(contradictory.sort()).toEqual([...CONTRADICTORY].sort());
  });

  /**
   * The consequence, stated so it cannot be mistaken for a CEE bug: those
   * fields permit an IRI and offer no IRIs. Whatever an editor stores, the
   * document cannot validate.
   */
  it('the contradictory fields offer no IRI-valued source to draw from', () => {
    const template = corpusTemplates().find((t) => t.id === '029');
    const language = (
      (template!.json as Record<string, never>)['properties']['Data File Language']['properties'][
        'Primary Language'
      ] as Record<string, never>
    )['_valueConstraints'] as Record<string, unknown>;

    expect(Array.isArray(language.literals) && (language.literals as unknown[]).length).toBeGreaterThan(0);
    for (const iriSource of ['ontologies', 'classes', 'branches', 'valueSets']) {
      expect((language[iriSource] as unknown[] | undefined) ?? [], iriSource).toHaveLength(0);
    }
  });
});
