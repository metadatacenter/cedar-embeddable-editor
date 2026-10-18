import { IdentifierPolicy } from 'cedar-model-typescript-library';

/** Identifier syntax shared with the model; resolution and membership belong to the host. */
export function validAbsoluteIri(value: string): boolean {
  return IdentifierPolicy.isValidAuthoringIri(value);
}

/** Populated field IRIs keep their original RDF spelling; no URL serialization or space stripping. */
export function validAbsoluteFieldIri(value: string): boolean {
  return IdentifierPolicy.isValidAuthoringIri(value, true);
}
