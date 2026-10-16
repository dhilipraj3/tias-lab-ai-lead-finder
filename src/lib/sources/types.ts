// src/lib/sources/types.ts
import { RawCandidateInput } from '../scoring';

export interface SourceSyncOutcome {
  sourceId: string;
  wasSearched: boolean; // Requirement #10: False when credentials are missing or source is disabled
  httpStatus: number | null;
  itemsScanned: number;
  candidates: RawCandidateInput[];
  status: 'SUCCESS' | 'ZERO_RESULTS' | 'SKIPPED_MISSING_CREDENTIALS' | 'ERROR';
  errorMessage?: string;
}

export interface LeadSourceConnector {
  readonly id: string;
  readonly name: string;
  readonly requiresEnvSecret?: string;
  fetchCandidates(env: Record<string, string | undefined>): Promise<SourceSyncOutcome>;
}
