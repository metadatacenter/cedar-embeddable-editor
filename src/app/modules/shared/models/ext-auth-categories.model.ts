import { InputType } from './input-type.model';

export const EXTERNAL_AUTHORITY_INPUT_TYPES: ReadonlySet<InputType> = new Set<InputType>([
  InputType.orcid,
  InputType.ror,
  InputType.pfas,
  InputType.nihGrant,
  InputType.doi,
]);
