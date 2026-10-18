import { JsonSourcePolicy } from 'cedar-model-typescript-library';
import {
  NumericPolicy,
  ExactDecimal,
  TextPolicy,
  JsonNode,
  Template,
  TemplateElement,
  TemplateField,
  CedarFieldType,
  NumericField,
  TemporalField,
  LinkField,
  ControlledTermField,
  ControlledTermDefaultValueBuilder,
  Iri,
} from 'cedar-model-typescript-library';

/** Preserve well-shaped defaults which violate constraints, so the live report can locate them. */
function deferredDefault(source: JsonNode): number | string | { termUri: string; label: string } | undefined {
  const type = (source['_ui'] as JsonNode | undefined)?.['inputType'];
  const value = (source['_valueConstraints'] as JsonNode | undefined)?.['defaultValue'];
  if (
    (type === 'temporal' || type === 'link' || (typeof type === 'string' && type.startsWith('ext-'))) &&
    typeof value === 'string'
  )
    return value;
  const term = value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonNode) : null;
  if (
    term &&
    typeof term['termUri'] === 'string' &&
    term['termUri'] !== '' &&
    typeof term['rdfs:label'] === 'string' &&
    !TextPolicy.isBlank(term['rdfs:label'])
  )
    return { termUri: term['termUri'], label: term['rdfs:label'] };
  if (type === 'numeric' && (typeof value === 'number' || typeof value === 'string' || ExactDecimal.isExact(value))) {
    try {
      const exact = NumericPolicy.value(value);
      return typeof exact === 'number' ? exact : String(exact);
    } catch {
      return undefined;
    }
  }
  return undefined;
}
export function withoutCheckedDefaults(source: JsonNode): JsonNode {
  const copy = JsonSourcePolicy.clone(source);
  const visit = (node: JsonNode) => {
    if (deferredDefault(node) !== undefined) delete (node['_valueConstraints'] as JsonNode)['defaultValue'];
    const properties = node['properties'] as JsonNode | undefined;
    for (const value of Object.values(properties ?? {}))
      if (value && typeof value === 'object' && !Array.isArray(value)) visit(value as JsonNode);
    if (node['items'] && typeof node['items'] === 'object') visit(node['items'] as JsonNode);
  };
  visit(copy);
  return copy;
}
export function restoreDeclaredDefaults(model: Template | TemplateElement | TemplateField, source: JsonNode): void {
  const definition = (source['items'] ?? source) as JsonNode;
  if (model instanceof Template || model instanceof TemplateElement) {
    const properties = definition['properties'] as JsonNode | undefined;
    for (const child of model.getChildrenInfo().children) {
      const artifact = model.getChild(child.name);
      const original = properties?.[child.name];
      if (artifact && original)
        restoreDeclaredDefaults(artifact as TemplateElement | TemplateField, original as JsonNode);
    }
  } else {
    const value = deferredDefault(definition);
    const type = (definition['_ui'] as JsonNode | undefined)?.['inputType'];
    if ((type === 'link' || (typeof type === 'string' && type.startsWith('ext-'))) && typeof value === 'string')
      (model as LinkField).valueConstraints.defaultValue = new Iri(value);
    if (value !== undefined && typeof value === 'object')
      (model as ControlledTermField).valueConstraints.defaultValue = new ControlledTermDefaultValueBuilder()
        .withTermUri(new Iri(value.termUri))
        .withRdfsLabel(value.label)
        .build();
    if (model.cedarFieldType === CedarFieldType.NUMERIC && (typeof value === 'number' || typeof value === 'string'))
      (model as NumericField).valueConstraints.defaultValue = NumericPolicy.value(value);
    if (model.cedarFieldType === CedarFieldType.TEMPORAL && typeof value === 'string')
      (model as TemporalField).valueConstraints.defaultValue = value;
  }
}
