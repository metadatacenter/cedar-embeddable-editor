import { RorDetailResponse } from '../ror-detail/ror-detail-response';

export interface RorSearchResponseItem {
  id: string;
  rdfsLabel: string;
  details?: RorDetailResponse;
}
