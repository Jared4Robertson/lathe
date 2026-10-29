// The Specification aggregate's commands as the app sends them (LA-AUT-A5): each route, POST /api/specification/<command>, with
// its input, the type its command file declares. Its editor sends only these, one command per change; a test holds
// this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddPredicate } from '../../../../lathe/src/authoring/specification/commands/add-predicate';
import type { AddSpecification } from '../../../../lathe/src/authoring/specification/commands/add-specification';
import type { AddSpecificationTest } from '../../../../lathe/src/authoring/specification/commands/add-specification-test';
import type { ChangePredicate } from '../../../../lathe/src/authoring/specification/commands/change-predicate';
import type { ChangeSpecification } from '../../../../lathe/src/authoring/specification/commands/change-specification';
import type { ChangeSpecificationTest } from '../../../../lathe/src/authoring/specification/commands/change-specification-test';
import type { RemovePredicate } from '../../../../lathe/src/authoring/specification/commands/remove-predicate';
import type { RemoveSpecification } from '../../../../lathe/src/authoring/specification/commands/remove-specification';
import type { RemoveSpecificationTest } from '../../../../lathe/src/authoring/specification/commands/remove-specification-test';

/** Each command's route, with its input. */
export interface SpecificationCommands {
  '/api/specification/add-predicate': AddPredicate;
  '/api/specification/add-specification': AddSpecification;
  '/api/specification/add-specification-test': AddSpecificationTest;
  '/api/specification/change-predicate': ChangePredicate;
  '/api/specification/change-specification': ChangeSpecification;
  '/api/specification/change-specification-test': ChangeSpecificationTest;
  '/api/specification/remove-predicate': RemovePredicate;
  '/api/specification/remove-specification': RemoveSpecification;
  '/api/specification/remove-specification-test': RemoveSpecificationTest;
}

export type SpecificationRoute = keyof SpecificationCommands;

/** Sends one command through the shell's writer: its route and its input, typed by the route. */
export const sendSpecification = <R extends SpecificationRoute>(writer: Writer, route: R, input: SpecificationCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
