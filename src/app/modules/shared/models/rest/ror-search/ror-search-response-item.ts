import { RorDetailResponse } from '../ror-detail/ror-detail-response';
import { JsonSchema } from '../../json-schema.model';

export interface RorSearchResponseItem {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  [JsonSchema.atId]: string;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  [JsonSchema.rdfsLabel]: string;
  details?: RorDetailResponse;
}
