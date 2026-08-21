import { ModelLibraryTemplateParser } from './model-library-template-parser';
import { TemplateParser } from './template-parser';
import { YamlTemplateParser } from './yaml-template-parser';

/**
 * Which reader a template needs, decided from the template.
 *
 * A host used to declare this, through an `inputSerialization` config key set to
 * `json` or `yaml`. It was a host asserting something the artifact already says:
 * CEDAR's two serialisations do not resemble each other, and every template
 * carries the evidence.
 *
 * Measured rather than assumed. Over the 37 corpus templates, each shipped in
 * both forms, eighteen top-level keys appear in every JSON template and in no
 * YAML one — `@context`, `@type`, `properties`, `$schema`, `_ui` and the `pav:`
 * and `schema:` families among them — while `modelVersion`, `name`, `status` and
 * `version` appear in every YAML template and in no JSON one. Not one key is
 * shared between the two sets. Widening to every JSON template the harness
 * carries, including the vendored HuBMAP production artifacts, all 94 have both
 * `@context` and `properties`.
 *
 * That is structural rather than incidental. The JSON form is JSON-LD, so
 * `@context` and `@type` are not optional decoration, and CEDAR's JSON Schema
 * form nests children under `properties`. The YAML form is a plain authoring
 * format with `children` and no JSON-LD envelope at all.
 *
 * JSON is the answer when nothing matches, which keeps the previous default and
 * means an object that is neither shape fails in the reader a host is most
 * likely to have meant — reporting that this is not a CEDAR template, rather
 * than that it is not valid YAML.
 */
export const selectTemplateParser = (template: object): TemplateParser => {
  const looksLikeJsonLd = '@context' in template || '@type' in template || 'properties' in template;
  if (looksLikeJsonLd) {
    return new ModelLibraryTemplateParser();
  }
  const looksLikeCedarYaml = 'modelVersion' in template || 'children' in template;
  return looksLikeCedarYaml ? new YamlTemplateParser() : new ModelLibraryTemplateParser();
};
