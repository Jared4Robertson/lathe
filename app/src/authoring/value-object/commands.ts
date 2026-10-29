// The Value object aggregate's commands as the app sends them (LA-AUT-A9): each route, POST /api/value-object/<command>, with
// its input, the type its command file declares. Its editor sends only these, one command per change; a test holds
// this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddConstraint } from '../../../../lathe/src/authoring/value-object/commands/add-constraint';
import type { AddConstraintTest } from '../../../../lathe/src/authoring/value-object/commands/add-constraint-test';
import type { AddValueObject } from '../../../../lathe/src/authoring/value-object/commands/add-value-object';
import type { AddValueType } from '../../../../lathe/src/authoring/value-object/commands/add-value-type';
import type { ChangeConstraint } from '../../../../lathe/src/authoring/value-object/commands/change-constraint';
import type { ChangeConstraintTest } from '../../../../lathe/src/authoring/value-object/commands/change-constraint-test';
import type { ChangeValueObject } from '../../../../lathe/src/authoring/value-object/commands/change-value-object';
import type { ChangeValueType } from '../../../../lathe/src/authoring/value-object/commands/change-value-type';
import type { RemoveConstraint } from '../../../../lathe/src/authoring/value-object/commands/remove-constraint';
import type { RemoveConstraintTest } from '../../../../lathe/src/authoring/value-object/commands/remove-constraint-test';
import type { RemoveValueObject } from '../../../../lathe/src/authoring/value-object/commands/remove-value-object';
import type { RemoveValueType } from '../../../../lathe/src/authoring/value-object/commands/remove-value-type';

/** Each command's route, with its input. */
export interface ValueObjectCommands {
  '/api/value-object/add-constraint': AddConstraint;
  '/api/value-object/add-constraint-test': AddConstraintTest;
  '/api/value-object/add-value-object': AddValueObject;
  '/api/value-object/add-value-type': AddValueType;
  '/api/value-object/change-constraint': ChangeConstraint;
  '/api/value-object/change-constraint-test': ChangeConstraintTest;
  '/api/value-object/change-value-object': ChangeValueObject;
  '/api/value-object/change-value-type': ChangeValueType;
  '/api/value-object/remove-constraint': RemoveConstraint;
  '/api/value-object/remove-constraint-test': RemoveConstraintTest;
  '/api/value-object/remove-value-object': RemoveValueObject;
  '/api/value-object/remove-value-type': RemoveValueType;
}

export type ValueObjectRoute = keyof ValueObjectCommands;

/** Sends one command through the shell's writer: its route and its input, typed by the route. */
export const sendValueObject = <R extends ValueObjectRoute>(writer: Writer, route: R, input: ValueObjectCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
