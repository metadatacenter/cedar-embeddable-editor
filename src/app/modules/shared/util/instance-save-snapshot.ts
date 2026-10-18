import { JsonSourcePolicy } from 'cedar-model-typescript-library';
import { InstanceDataContainer } from 'cedar-model-typescript-library';
import { CeeJsonObject, CeeSaveSnapshot } from '../../../cee-public-api';
import { validAbsoluteIri } from '../validation/absolute-iri';

type Path = (string | number)[];

function containers(root: InstanceDataContainer): { node: InstanceDataContainer; path: Path }[] {
  const result: { node: InstanceDataContainer; path: Path }[] = [];
  const visit = (value: unknown, path: Path): void => {
    if (Array.isArray(value)) value.forEach((item, index) => visit(item, [...path, index]));
    else if (value instanceof InstanceDataContainer) {
      if (path.length) result.push({ node: value, path });
      Object.entries(value.values).forEach(([key, child]) => visit(child, [...path, key]));
    }
  };
  visit(root, []);
  return result;
}

function at(document: CeeJsonObject, path: Path): CeeJsonObject {
  let value: unknown = document;
  for (const key of path) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key))
      throw new Error('Saved instance is missing a submitted element.');
    value = (value as Record<string | number, unknown>)[key];
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Saved instance has an invalid element.');
  return value as CeeJsonObject;
}

/** Bind repository identities to the submitted objects, never to their later array positions. */
export function captureInstanceSave(
  metadata: CeeJsonObject,
  root: InstanceDataContainer,
  currentRoot: () => InstanceDataContainer | null,
  invalidate: () => void,
): CeeSaveSnapshot {
  const submitted = JsonSourcePolicy.clone(metadata);
  const entries = containers(root).map((entry) => ({ ...entry, id: entry.node.id }));
  let acknowledged = false;
  return {
    metadata: JsonSourcePolicy.clone(submitted),
    needsElementIds: entries.some(({ id }) => !id),
    acknowledge(stored) {
      if (acknowledged || currentRoot() !== root) throw new Error('Save snapshot is no longer current.');
      const live = new Set(containers(root).map(({ node }) => node));
      // Validate the complete acknowledgement before changing any working object.
      const updates = entries.map(({ node, path, id }) => {
        const savedId = at(stored, path)['@id'];
        if (typeof savedId !== 'string' || !validAbsoluteIri(savedId) || (id && id !== savedId))
          throw new Error('Saved instance has an invalid or changed element identifier.');
        if (live.has(node) && node.id !== id) throw new Error('Element identity changed during save.');
        return { node, path, savedId };
      });
      const baseline = JsonSourcePolicy.clone(submitted);
      for (const { path, savedId } of updates) {
        at(baseline, path)['@id'] = savedId;
      }
      for (const { node, savedId } of updates) {
        if (live.has(node)) node.id = savedId;
      }
      acknowledged = true;
      invalidate();
      return baseline;
    },
  };
}
