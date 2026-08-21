/**
 * The reader is chosen from the template, and gets it right for every template.
 *
 * A host used to declare this through an `inputSerialization` key. The claim that
 * replaced it — that CEDAR's two serialisations are distinguishable by shape — is
 * only worth as much as the corpus it holds over, so it is asserted here against
 * all of it: every template in both forms, each expected to select the reader that
 * can actually read it.
 *
 * `format-independence.spec.ts` asks a different question, and the two are
 * complements. That one passes both parsers explicitly and requires the resulting
 * trees to match. This one asks whether the parser a template gets *by itself* is
 * the right one. Without it, detection could be wrong in a way parity never sees,
 * because parity never lets the artifact choose.
 */
import { describe, expect, it } from 'vitest';
import { selectTemplateParser } from '@cee/factory/select-template-parser';
import { ModelLibraryTemplateParser } from '@cee/factory/model-library-template-parser';
import { YamlTemplateParser } from '@cee/factory/yaml-template-parser';
import { corpusTemplates, corpusTemplatesYaml } from '../src/corpus';

describe('the reader a template selects for itself', () => {
  it.each(corpusTemplates().map(({ id, json }) => [id, json] as const))(
    '%s as JSON selects the JSON reader',
    (_id, template) => {
      expect(selectTemplateParser(template)).toBeInstanceOf(ModelLibraryTemplateParser);
    },
  );

  it.each(corpusTemplatesYaml().map(({ id, json }) => [id, json] as const))(
    '%s as YAML selects the YAML reader',
    (_id, template) => {
      expect(selectTemplateParser(template)).toBeInstanceOf(YamlTemplateParser);
    },
  );
});

describe('an object that is neither shape', () => {
  /**
   * JSON is the answer, which keeps the previous default. The point is not that
   * an empty object is a template — it is that a host handing over something
   * unreadable gets the reader it most likely meant, and so an error about the
   * artifact not being a CEDAR template rather than about it not being valid YAML.
   */
  it('falls back to the JSON reader', () => {
    expect(selectTemplateParser({})).toBeInstanceOf(ModelLibraryTemplateParser);
    expect(selectTemplateParser({ nothing: 'recognisable' })).toBeInstanceOf(ModelLibraryTemplateParser);
  });

  it('does not mistake an instance for a YAML template', () => {
    // An instance carries `@context` like a JSON template does, so it takes the
    // JSON reader and fails there, which is where its error belongs.
    expect(selectTemplateParser({ '@context': {}, 'schema:name': 'an instance' })).toBeInstanceOf(
      ModelLibraryTemplateParser,
    );
  });
});
