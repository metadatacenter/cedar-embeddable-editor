/**
 * The language a field declares for its values.
 *
 * A field's `@context` may state a `@language`, and the model library reads it as the artifact's
 * language. CEE carries it onto the field's basic info, where a widget marks the control holding the
 * field's value with it. A field that states none carries null, so the value takes the language of
 * the text around it.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

const text = FIELD_KINDS.find((kind) => kind.key === 'text')!;

/** A template of one text field, with the language its `@context` states, if any. */
const templateWith = (language?: string): Record<string, any> => {
  const template = buildTemplate({ name: 'value_language', children: [{ kind: text, name: 'f' }] }) as Record<
    string,
    any
  >;
  if (language !== undefined) template.properties._f['@context']['@language'] = language;
  return template;
};

describe("a field's declared value language", () => {
  it('is read from the language its context states', () => {
    expect(new CeeDriver(templateWith('fr')).findOrThrow(['_f']).basicInfo.valueLanguage).toBe('fr');
  });

  it('is null where the context states none', () => {
    expect(new CeeDriver(templateWith()).findOrThrow(['_f']).basicInfo.valueLanguage).toBeNull();
  });
});
