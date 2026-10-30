import type { PatternFollowers } from '../../../../lathe/src/traceability/pattern-following/read-model';
import { useRead, type Read } from '../../record/read';

// The Pattern following aggregate's reads as the Pattern page makes them (LA-TRC-RM10): a pattern's followers by
// domain, each with the values it gives the pattern's settings (list-followers).

/** The pattern's followers, as its Followed by and its rules' Owed by read them: read again whenever the data is (`version`). */
export const useFollowers = (pattern: string, version: unknown): Read<PatternFollowers> => useRead<PatternFollowers>('/api/pattern-following/list-followers', { pattern_id: pattern }, version);
