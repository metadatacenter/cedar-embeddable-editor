import {
  AbstractFieldChildDeploymentInfoBuilder,
  BiboStatus,
  CedarBuilders,
  CedarReaders,
  CedarWriters,
  JsonNode,
  SchemaVersion,
  TemplateField,
} from 'cedar-model-typescript-library';

/**
 * The property the synthetic template deploys its one field under.
 *
 * Fixed rather than derived from the field's name, so the path a widget is bound to
 * is the same for every field the element is handed, and a field whose name is empty
 * or unusable as a key is not a special case.
 */
export const SINGLE_FIELD_PROPERTY = 'value';

/** What the synthetic template calls itself, which nothing renders. */
const SINGLE_FIELD_TEMPLATE_NAME = 'Single field';

/**
 * What the synthetic template is, said in a form nothing will try to resolve.
 *
 * A template with no `@id` is reported, and rightly: an instance of it cannot record
 * which template it came from. No instance of this one is ever stored — the element
 * produces a value, not a document — so what the report asks for is an identifier, and
 * the honest identifier for a wrapper CEE builds around a field is a URN naming the
 * wrapper. A repository IRI here would be a claim that some artifact server holds this
 * template, which none does.
 */
const SINGLE_FIELD_TEMPLATE_ID = 'urn:cedar:cee:single-field-template';

/**
 * A field artifact, wrapped in the smallest template that can hold it.
 *
 * Everything CEE knows how to render is reached through a template: the component
 * tree, the instance skeleton beneath it, and the path that ties one widget to one
 * slot in that instance. A field on its own has none of those — it is a schema for a
 * value, with no statement about where the value goes — so the `cedar-embeddable-field`
 * element makes the missing statement in the only place it can be made once, here,
 * rather than asking every host to hand over a template it does not have.
 *
 * The deployment is all this decides. Cardinality lives on the deployment, so the value
 * is single. So does requirement. A template or element says whether the field it places
 * is required or recommended, and a field written on its own says neither. The strict
 * reader refuses one that does, as both model libraries do. The host's configuration says
 * whether it places the field as required, and the deployment states it, so an empty value
 * is reported as missing exactly as it is in a form. A field type that keeps no
 * requirement, such as an attribute-value field or a static one, takes none.
 */
export function templateForField(fieldJson: JsonNode, required = false): JsonNode {
  const field: TemplateField = CedarReaders.json().getStrict().getTemplateFieldReader().readFromObject(fieldJson).field;
  const template = CedarBuilders.templateBuilder()
    .withAtId(SINGLE_FIELD_TEMPLATE_ID)
    .withSchemaName(SINGLE_FIELD_TEMPLATE_NAME)
    .withSchemaVersion(SchemaVersion.CURRENT)
    .withStatus(BiboStatus.DRAFT)
    .build();

  const deployment = field.createDeploymentBuilder(SINGLE_FIELD_PROPERTY);
  if (deployment instanceof AbstractFieldChildDeploymentInfoBuilder) {
    deployment.withRequiredValue(required);
  }
  /*
   * Added to the built template rather than through the builder's own `addChild`,
   * which declares the one dynamic deployment class and so cannot take the static
   * one a section break or an image builds. The container's method takes the base
   * both extend, and a static field is a field this element renders.
   */
  template.addChild(field, deployment.build());

  return CedarWriters.json().getStrict().getTemplateWriter().getAsJsonNode(template);
}
