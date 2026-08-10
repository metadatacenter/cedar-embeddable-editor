/**
 * The name a fetched sample template goes by.
 *
 * `SampleTemplatesService` shows a menu of sample templates, labelled by each
 * one's `schema:name`. It used to reach into the fetched document for that key,
 * which made it the only place outside CEE's three artifact boundaries — template
 * in, instance in, instance out — that opened a CEDAR document itself.
 *
 * It reads through the model library now. Two key lookups is a small thing; the
 * point of the boundaries is that there are three of them and not four.
 *
 * Tested against the real corpus templates rather than a fixture, because the
 * question is whether the library's reader finds the name in documents CEE did
 * not generate — including the malformed one.
 */
import { describe, expect, it } from 'vitest';
import { CedarArtifactType, CedarReaders, JsonSchema } from 'cedar-model-typescript-library';
import { corpusTemplates } from '../src/corpus';

/** What the service does, minus the HTTP. */
const labelFor = (template: object): string | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = CedarReaders.json()
      .getFebruary2024()
      .getTemplateReader()
      .readFromObject(template as any).template;
    return parsed.schema_name || null;
  } catch {
    return null;
  }
};

/** What it used to do. */
const labelByHand = (template: object): string | null => (template as Record<string, string>)['schema:name'] || null;

const templates = corpusTemplates();

describe('the label the library reads', () => {
  it('there are templates to check', () => {
    expect(templates.length).toBeGreaterThan(30);
  });

  /**
   * The differential: the library must find the same name the key lookup did, on
   * every real template. Anything else would change what the menu says.
   */
  it.each(templates.map((t) => [t.id, t] as const))('template-%s: same name as the key lookup', (_id, artifact) => {
    expect(labelFor(artifact.json)).toBe(labelByHand(artifact.json));
  });

  it('every corpus template yields a non-empty name', () => {
    const nameless = templates.filter((t) => !labelFor(t.json)).map((t) => t.id);
    expect(nameless, 'a template with no name would show as a blank menu entry').toEqual([]);
  });
});

describe('templates that cannot be read', () => {
  /**
   * The menu must not break on a document that is not a template. The previous
   * code returned null for anything without a `schema:name`; parsing has more ways
   * to go wrong, so the failure has to be contained rather than thrown at the
   * subscriber.
   */
  it.each([
    ['an empty object', {}],
    ['a document with no name', { [JsonSchema.atType]: CedarArtifactType.TEMPLATE.getValue() }],
    ['something that is not a template at all', { hello: 'world' }],
  ])('%s yields no name rather than throwing', (_label, document) => {
    expect(() => labelFor(document)).not.toThrow();
    expect(labelFor(document)).toBeNull();
  });
});
