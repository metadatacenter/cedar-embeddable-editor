import * as Model from 'cedar-model-typescript-library';
import type { TemplateElement } from 'cedar-model-typescript-library';
const { CedarBuilders, CedarWriters, TemporalType, TemporalGranularity } = (
  'default' in Model ? Model.default : Model
) as typeof Model;

/** Model-built fixtures shared by real Angular and browser transition tests. No test runtime dependencies. */
export function draftTemplate(depth: number, type: 'temporal' | 'attrValue' | 'text'): object {
  const field =
    type === 'temporal'
      ? CedarBuilders.temporalFieldBuilder()
          .withSchemaName('f')
          .withTitle('f')
          .withTemporalType(TemporalType.DATETIME)
          .withTemporalGranularity(TemporalGranularity.MINUTE)
          .build()
      : type === 'text'
        ? CedarBuilders.textFieldBuilder().withSchemaName('f').withTitle('f').build()
        : CedarBuilders.attributeValueFieldBuilder().withSchemaName('f').withTitle('f').build();
  let element: TemplateElement | null = null;
  for (let level = depth - 1; level >= 0; level--) {
    const builder = CedarBuilders.templateElementBuilder().withSchemaName(`level${level}`).withTitle(`level${level}`);
    if (element === null) {
      // An attribute-value field starts with no rows, since no template may require
      // attributes; a test that needs an unnamed row adds one, as a user would.
      const deployment = field.createDeploymentBuilder('_f').withLabel('f');
      builder.addChild(field, deployment.build());
    } else {
      builder.addChild(
        element,
        element
          .createDeploymentBuilder(`_level${level + 1}`)
          .withLabel(`level${level + 1}`)
          .withMultiInstance(true)
          .withMinItems(level + 1 === depth - 1 ? 2 : 1)
          .withMaxItems(5)
          .build(),
      );
    }
    element = builder.build();
  }
  const template = CedarBuilders.templateBuilder()
    .withAtId('https://example.org/template/draft-matrix')
    .withSchemaName('draft matrix')
    .withTitle('draft matrix')
    .addChild(
      element!,
      element!
        .createDeploymentBuilder('_level0')
        .withLabel('level0')
        .withMultiInstance(true)
        .withMinItems(depth === 1 ? 2 : 1)
        .withMaxItems(5)
        .build(),
    )
    .build();
  return JSON.parse(JSON.stringify(CedarWriters.json().getStrict().getTemplateWriter().getAsJsonNode(template)));
}

/** What `occurrenceContext` reads of an element's schema. */
interface ElementSchemaShape {
  properties?: { '@context'?: { properties?: Record<string, { enum?: unknown[] }> } };
  _ui: { order: string[] };
}

/**
 * The `@context` a stored occurrence of an element carries, read from the element's schema.
 *
 * `@context` is what marks an element value, and the model library refuses an occurrence without one
 * that carries a child. A stored occurrence binds each child the schema gives a property IRI to that
 * IRI. A child with none gets no entry, so an element whose children have no IRIs carries `{}`.
 */
export function occurrenceContext(schema: object): Record<string, string> {
  const element = schema as ElementSchemaShape;
  const declared = element.properties?.['@context']?.properties ?? {};
  return Object.fromEntries(
    element._ui.order.flatMap((key) => {
      const iri = declared[key]?.enum?.[0];
      return typeof iri === 'string' ? [[key, iri]] : [];
    }),
  );
}

/** The `@context` an occurrence of each level of a draft template carries, outermost level first. */
export function draftContexts(template: object, depth: number): Record<string, string>[] {
  const contexts: Record<string, string>[] = [];
  let schema = template as { properties: Record<string, { items: object }> };
  for (let level = 0; level < depth; level++) {
    const element = schema.properties[`_level${level}`].items;
    contexts.push(occurrenceContext(element));
    schema = element as typeof schema;
  }
  return contexts;
}
