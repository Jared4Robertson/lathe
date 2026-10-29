import type { UseCaseKind } from '../../../../lathe/src/authoring/use-case/model';
import type { FlowOnPage, StepOnPage, UseCasePage } from '../../../../lathe/src/authoring/use-case/read-model';
import { useRead, type Read } from '../../record/read';

// The Use case aggregate's reads as its page makes them, each answered from its read model (LA-AUT-RM11): a use case
// whole as its page shows it, by the ID of any record in it (get-use-case), and the next free ID for a record of one of
// its kinds under its parent (next-id).

/** The use case that holds the record, whole as its page shows it: read again whenever the data is (`version`). */
export const useUseCase = (id: string, version: unknown): Read<UseCasePage> => useRead<UseCasePage>('/api/use-case/get-use-case', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextId = (kind: UseCaseKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/use-case/next-id', { kind, parent }, version);

/** Every step of a flow as the read model holds it, path by path. */
export const stepsOf = (flow: FlowOnPage): StepOnPage[] => flow.paths.flatMap((p) => p.steps);
