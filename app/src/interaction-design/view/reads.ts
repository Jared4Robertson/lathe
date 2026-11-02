import type { ViewKind } from '../../../../lathe/src/interaction-design/view/model';
import type { ViewPage } from '../../../../lathe/src/interaction-design/view/read-model';
import { useRead, type Read } from '../../record/read';

// The View aggregate's reads as its page makes them (LA-IXD-RM32): a view whole as its page shows it, by the ID of any
// record in it (get-view), and the next free ID for a view, requirement or test under its parent (next-id).

/** The view that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useView = (id: string, version: unknown): Read<ViewPage> => useRead<ViewPage>('/api/view/get-view', { id }, version);

/** The next free ID for a record of the kind under its parent (a view under its product), as the editor suggests it. */
export const useNextViewId = (kind: ViewKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/view/next-id', { kind, parent }, version);
