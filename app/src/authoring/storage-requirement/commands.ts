// The Storage requirement aggregate's commands as the app sends them (LA-AUT-A22): each route, POST
// /api/storage-requirement/<command>, with its input, the type its command file declares. The editor sends only these,
// one command per change; a test holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddStorageRequirement } from '../../../../lathe/src/authoring/storage-requirement/commands/add-storage-requirement';
import type { ChangeStorageRequirement } from '../../../../lathe/src/authoring/storage-requirement/commands/change-storage-requirement';
import type { RemoveStorageRequirement } from '../../../../lathe/src/authoring/storage-requirement/commands/remove-storage-requirement';
import type { AddStorageRequirementTest } from '../../../../lathe/src/authoring/storage-requirement/commands/add-storage-requirement-test';
import type { ChangeStorageRequirementTest } from '../../../../lathe/src/authoring/storage-requirement/commands/change-storage-requirement-test';
import type { RemoveStorageRequirementTest } from '../../../../lathe/src/authoring/storage-requirement/commands/remove-storage-requirement-test';

/** Each command's route, with its input. */
export interface StorageRequirementCommands {
  '/api/storage-requirement/add-storage-requirement': AddStorageRequirement;
  '/api/storage-requirement/change-storage-requirement': ChangeStorageRequirement;
  '/api/storage-requirement/remove-storage-requirement': RemoveStorageRequirement;
  '/api/storage-requirement/add-storage-requirement-test': AddStorageRequirementTest;
  '/api/storage-requirement/change-storage-requirement-test': ChangeStorageRequirementTest;
  '/api/storage-requirement/remove-storage-requirement-test': RemoveStorageRequirementTest;
}

export type StorageRequirementRoute = keyof StorageRequirementCommands;

/** Sends one Storage requirement command through the shell's writer: its route and its input, typed by the route. */
export const sendStorageRequirement = <R extends StorageRequirementRoute>(writer: Writer, route: R, input: StorageRequirementCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
