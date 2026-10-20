/**
 * The language a template or element declares for its own text.
 *
 * A template's or an element's `@context` may state a `@language`, and the model library reads it as
 * the artifact's language. CEE carries it onto the label info of the template and of each component
 * whose label and description that artifact holds, where the form marks that text with it. A nested
 * element that states a language of its own passes that one on instead. A field's own `@language` is
 * the language of its values and does not change the language of its label.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

const text = FIELD_KINDS.find((kind) => kind.key === 'text')!;

/**
 * A template holding a text field and an element with a text field of its own, with the languages
 * the template's, the element's and the field's contexts state, where they state one.
 */
const templateWith = (languages: { template?: string; element?: string; field?: string }): Record<string, any> => {
  const template = buildTemplate({
    name: 'text_language',
    children: [{ kind: text, name: 'f' }],
    elements: [{ name: 'e', children: [{ kind: text, name: 'g' }] }],
  }) as Record<string, any>;
  if (languages.template !== undefined) template['@context']['@language'] = languages.template;
  if (languages.element !== undefined) template.properties._e['@context']['@language'] = languages.element;
  if (languages.field !== undefined) template.properties._f['@context']['@language'] = languages.field;
  return template;
};

describe("a template's declared text language", () => {
  it('is the language of the template and of every component it holds', () => {
    const driver = new CeeDriver(templateWith({ template: 'fr' }));
    expect(driver.representation.labelInfo.language).toBe('fr');
    expect(driver.findOrThrow(['_f']).labelInfo.language).toBe('fr');
    expect(driver.findOrThrow(['_e']).labelInfo.language).toBe('fr');
    expect(driver.findOrThrow(['_e', '_g']).labelInfo.language).toBe('fr');
  });

  it("gives way to a nested element's own, for the element and what it holds", () => {
    const driver = new CeeDriver(templateWith({ template: 'fr', element: 'de' }));
    expect(driver.findOrThrow(['_f']).labelInfo.language).toBe('fr');
    expect(driver.findOrThrow(['_e']).labelInfo.language).toBe('de');
    expect(driver.findOrThrow(['_e', '_g']).labelInfo.language).toBe('de');
  });

  it("is not changed by a field's own language, which is the language of its values", () => {
    const field = new CeeDriver(templateWith({ template: 'fr', field: 'it' })).findOrThrow(['_f']);
    expect(field.labelInfo.language).toBe('fr');
    expect(field.basicInfo.valueLanguage).toBe('it');
  });

  it('is null where nothing declares one, and an element can declare one for itself alone', () => {
    const undeclared = new CeeDriver(templateWith({}));
    expect(undeclared.representation.labelInfo.language).toBeNull();
    expect(undeclared.findOrThrow(['_f']).labelInfo.language).toBeNull();
    const element = new CeeDriver(templateWith({ element: 'de' }));
    expect(element.findOrThrow(['_f']).labelInfo.language).toBeNull();
    expect(element.findOrThrow(['_e', '_g']).labelInfo.language).toBe('de');
  });
});
