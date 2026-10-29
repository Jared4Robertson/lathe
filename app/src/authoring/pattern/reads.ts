import type { PatternKind } from '../../../../lathe/src/authoring/pattern/model';
import type { PatternPage } from '../../../../lathe/src/authoring/pattern/read-model';
import { useRead, type Read } from '../../record/read';

// The Pattern aggregate's reads as its page makes them (LA-AUT-RM22): a pattern whole as its page shows it, by the ID of
// any record in it (get-pattern), and the next free ID for a rule or rule test under its parent (next-id).

/** The pattern that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const usePattern = (id: string, version: unknown): Read<PatternPage> => useRead<PatternPage>('/api/pattern/get-pattern', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextPatternId = (kind: Exclude<PatternKind, 'pattern'>, parent: string, version: unknown): Read<string> => useRead<string>('/api/pattern/next-id', { kind, parent }, version);
