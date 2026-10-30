import type { CheckPage } from '../../../../lathe/src/checking/check/read-model';
import { useRead, type Read } from '../../record/read';

// The Check aggregate's reads as its page makes them (LA-CHK-RM10): a check whole as its page shows it, by its name
// (get-check).

/** The check with the name, as its page reads it: read again whenever the data is (`version`). */
export const useCheck = (name: string, version: unknown): Read<CheckPage> => useRead<CheckPage>('/api/check/get-check', { name }, version);
