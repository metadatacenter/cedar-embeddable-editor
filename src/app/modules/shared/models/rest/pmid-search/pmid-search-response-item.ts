import { JsonSchema } from '../../json-schema.model';

export interface PmidSearchResponseItem {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  [JsonSchema.atId]: string;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  [JsonSchema.rdfsLabel]: string;
}
