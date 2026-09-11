import {
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
 * The deployment is bare, and that is the whole of what this decides. Requiredness
 * and cardinality live on the deployment rather than on the field, so a field artifact
 * carries neither and nothing here adds them: a lone value is single, and it is
 * allowed to be absent. Both matter for what the element is chiefly for — a default
 * value is optional by definition, and marking one required would put a validation
 * error under a box that is entitled to be empty.
 */
export function templateForField(fieldJson: JsonNode): JsonNode {
  const field: TemplateField = CedarReaders.json().getStrict().getTemplateFieldReader().readFromObject(fieldJson).field;
  const template = CedarBuilders.templateBuilder()
    .withAtId(SINGLE_FIELD_TEMPLATE_ID)
    .withSchemaName(SINGLE_FIELD_TEMPLATE_NAME)
    .withSchemaVersion(SchemaVersion.CURRENT)
    .withStatus(BiboStatus.DRAFT)
    .build();

  /*
   * Added to the built template rather than through the builder's own `addChild`,
   * which declares the one dynamic deployment class and so cannot take the static
   * one a section break or an image builds. The container's method takes the base
   * both extend, and a static field is a field this element renders.
   */
  template.addChild(field, field.createDeploymentBuilder(SINGLE_FIELD_PROPERTY).build());

  return CedarWriters.json().getStrict().getTemplateWriter().getAsJsonNode(template);
}
