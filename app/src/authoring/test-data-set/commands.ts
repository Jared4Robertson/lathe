// The Test data set aggregate's commands as the app sends them (LA-AUT-A17): each route, POST /api/test-data-set/<command>, with
// its input, the type its command file declares. The test data set's editor sends only these, one command per change; a test
// holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddTestDataSet } from '../../../../lathe/src/authoring/test-data-set/commands/add-test-data-set';
import type { ChangeTestDataSet } from '../../../../lathe/src/authoring/test-data-set/commands/change-test-data-set';
import type { RemoveTestDataSet } from '../../../../lathe/src/authoring/test-data-set/commands/remove-test-data-set';

/** Each command's route, with its input. */
export interface TestDataSetCommands {
  '/api/test-data-set/add-test-data-set': AddTestDataSet;
  '/api/test-data-set/change-test-data-set': ChangeTestDataSet;
  '/api/test-data-set/remove-test-data-set': RemoveTestDataSet;
}

export type TestDataSetRoute = keyof TestDataSetCommands;

/** Sends one Test data set command through the shell's writer: its route and its input, typed by the route. */
export const sendTestDataSet = <R extends TestDataSetRoute>(writer: Writer, route: R, input: TestDataSetCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
