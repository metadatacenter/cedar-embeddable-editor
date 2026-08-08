import { CedarReaders } from 'cedar-model-typescript-library';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { HandlerContext } from '../util/handler-context';
import { ModelLibraryTemplateParser } from './model-library-template-parser';
import { TemplateParser } from './template-parser';

/**
 * Build CEE's component tree from a template that arrived as YAML.
 *
 * The point of this class is how little there is of it. CEE's model of a
 * template is the CEDAR Model TypeScript Library's, and the library reads YAML
 * into the same `Template` it reads JSON into — so everything CEE does with a
 * template, from the rendered form to the instance it builds, is already
 * independent of how the template was written down. Only the first line
 * differs.
 *
 * That was not true before. CEE walked the JSON key by key against its own copy
 * of the CEDAR vocabulary, so `_ui.order`, `_valueConstraints` and the rest were
 * baked into the component tree's construction and a YAML template was simply
 * not something it could be handed.
 *
 * `format-independence.spec.ts` holds the claim to account: every one of the 37
 * corpus templates, read from JSON and from YAML, has to produce the same tree.
 */
export class YamlTemplateParser implements TemplateParser {
  parse(templateYaml: object, template: CedarTemplate, _handlerContext: HandlerContext): void {
    const result = CedarReaders.yaml()
      .getStrict()
      .getTemplateReader()
      .readFromObject(templateYaml as any);
    ModelLibraryTemplateParser.mapParsedTemplate(result.template, template);
  }
}
