// The Aggregate aggregate's commands as the app sends them (LA-AUT-A6): each route, POST /api/aggregate/<command>, with
// its input, the type its command file declares. The editor sends only these, one command per change; a test holds
// this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddAggregate } from '../../../../lathe/src/authoring/aggregate/commands/add-aggregate';
import type { AddDataModel } from '../../../../lathe/src/authoring/aggregate/commands/add-data-model';
import type { AddEntity } from '../../../../lathe/src/authoring/aggregate/commands/add-entity';
import type { AddInvariant } from '../../../../lathe/src/authoring/aggregate/commands/add-invariant';
import type { AddInvariantTest } from '../../../../lathe/src/authoring/aggregate/commands/add-invariant-test';
import type { ChangeAggregate } from '../../../../lathe/src/authoring/aggregate/commands/change-aggregate';
import type { ChangeDataModel } from '../../../../lathe/src/authoring/aggregate/commands/change-data-model';
import type { ChangeEntity } from '../../../../lathe/src/authoring/aggregate/commands/change-entity';
import type { ChangeInvariant } from '../../../../lathe/src/authoring/aggregate/commands/change-invariant';
import type { ChangeInvariantTest } from '../../../../lathe/src/authoring/aggregate/commands/change-invariant-test';
import type { RemoveAggregate } from '../../../../lathe/src/authoring/aggregate/commands/remove-aggregate';
import type { RemoveDataModel } from '../../../../lathe/src/authoring/aggregate/commands/remove-data-model';
import type { RemoveEntity } from '../../../../lathe/src/authoring/aggregate/commands/remove-entity';
import type { RemoveInvariant } from '../../../../lathe/src/authoring/aggregate/commands/remove-invariant';
import type { RemoveInvariantTest } from '../../../../lathe/src/authoring/aggregate/commands/remove-invariant-test';
import type { AddRule } from '../../../../lathe/src/authoring/aggregate/commands/add-rule';
import type { ChangeRule } from '../../../../lathe/src/authoring/aggregate/commands/change-rule';
import type { RemoveRule } from '../../../../lathe/src/authoring/aggregate/commands/remove-rule';

/** Each command's route, with its input. */
export interface AggregateCommands {
  '/api/aggregate/add-aggregate': AddAggregate;
  '/api/aggregate/add-data-model': AddDataModel;
  '/api/aggregate/add-entity': AddEntity;
  '/api/aggregate/add-invariant': AddInvariant;
  '/api/aggregate/add-invariant-test': AddInvariantTest;
  '/api/aggregate/change-aggregate': ChangeAggregate;
  '/api/aggregate/change-data-model': ChangeDataModel;
  '/api/aggregate/change-entity': ChangeEntity;
  '/api/aggregate/change-invariant': ChangeInvariant;
  '/api/aggregate/change-invariant-test': ChangeInvariantTest;
  '/api/aggregate/remove-aggregate': RemoveAggregate;
  '/api/aggregate/remove-data-model': RemoveDataModel;
  '/api/aggregate/remove-entity': RemoveEntity;
  '/api/aggregate/remove-invariant': RemoveInvariant;
  '/api/aggregate/remove-invariant-test': RemoveInvariantTest;
  '/api/aggregate/add-rule': AddRule;
  '/api/aggregate/change-rule': ChangeRule;
  '/api/aggregate/remove-rule': RemoveRule;
}

export type AggregateRoute = keyof AggregateCommands;

/** Sends one Aggregate command through the shell's writer: its route and its input, typed by the route. */
export const sendAggregate = <R extends AggregateRoute>(writer: Writer, route: R, input: AggregateCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
