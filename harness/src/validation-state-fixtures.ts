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
