// The Use case aggregate's commands as the app sends them (LA-AUT-A11): each route, POST /api/use-case/<command>, with
// its input, the type its command file declares. The use case's editor sends only these, one command per change; a
// test holds this list to the aggregate's command definitions (USE_CASE_COMMANDS), one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddFlowStep } from '../../../../lathe/src/authoring/use-case/commands/add-flow-step';
import type { AddFlowTest } from '../../../../lathe/src/authoring/use-case/commands/add-flow-test';
import type { AddFlow } from '../../../../lathe/src/authoring/use-case/commands/add-flow';
import type { AddUcRequirement } from '../../../../lathe/src/authoring/use-case/commands/add-uc-requirement';
import type { AddUseCaseTest } from '../../../../lathe/src/authoring/use-case/commands/add-use-case-test';
import type { AddUseCase } from '../../../../lathe/src/authoring/use-case/commands/add-use-case';
import type { ChangeFlowStep } from '../../../../lathe/src/authoring/use-case/commands/change-flow-step';
import type { ChangeFlowTest } from '../../../../lathe/src/authoring/use-case/commands/change-flow-test';
import type { ChangeFlow } from '../../../../lathe/src/authoring/use-case/commands/change-flow';
import type { ChangeUcRequirement } from '../../../../lathe/src/authoring/use-case/commands/change-uc-requirement';
import type { ChangeUseCaseTest } from '../../../../lathe/src/authoring/use-case/commands/change-use-case-test';
import type { ChangeUseCase } from '../../../../lathe/src/authoring/use-case/commands/change-use-case';
import type { MoveUseCase } from '../../../../lathe/src/authoring/use-case/commands/move-use-case';
import type { RemoveFlowStep } from '../../../../lathe/src/authoring/use-case/commands/remove-flow-step';
import type { RemoveFlowTest } from '../../../../lathe/src/authoring/use-case/commands/remove-flow-test';
import type { RemoveFlow } from '../../../../lathe/src/authoring/use-case/commands/remove-flow';
import type { RemoveUcRequirement } from '../../../../lathe/src/authoring/use-case/commands/remove-uc-requirement';
import type { RemoveUseCaseTest } from '../../../../lathe/src/authoring/use-case/commands/remove-use-case-test';
import type { RemoveUseCase } from '../../../../lathe/src/authoring/use-case/commands/remove-use-case';

/** Each command's route, with its input. */
export interface UseCaseCommands {
  '/api/use-case/add-flow-step': AddFlowStep;
  '/api/use-case/add-flow-test': AddFlowTest;
  '/api/use-case/add-flow': AddFlow;
  '/api/use-case/add-uc-requirement': AddUcRequirement;
  '/api/use-case/add-use-case-test': AddUseCaseTest;
  '/api/use-case/add-use-case': AddUseCase;
  '/api/use-case/change-flow-step': ChangeFlowStep;
  '/api/use-case/change-flow-test': ChangeFlowTest;
  '/api/use-case/change-flow': ChangeFlow;
  '/api/use-case/change-uc-requirement': ChangeUcRequirement;
  '/api/use-case/change-use-case-test': ChangeUseCaseTest;
  '/api/use-case/change-use-case': ChangeUseCase;
  '/api/use-case/move-use-case': MoveUseCase;
  '/api/use-case/remove-flow-step': RemoveFlowStep;
  '/api/use-case/remove-flow-test': RemoveFlowTest;
  '/api/use-case/remove-flow': RemoveFlow;
  '/api/use-case/remove-uc-requirement': RemoveUcRequirement;
  '/api/use-case/remove-use-case-test': RemoveUseCaseTest;
  '/api/use-case/remove-use-case': RemoveUseCase;
}

export type UseCaseRoute = keyof UseCaseCommands;

/** Sends one Use case command through the shell's writer: its route and its input, typed by the route. */
export const sendUseCase = <R extends UseCaseRoute>(writer: Writer, route: R, input: UseCaseCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
