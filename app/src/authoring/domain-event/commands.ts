// The Domain event aggregate's commands as the app sends them (LA-AUT-A7): each route, POST /api/domain-event/<command>, with
// its input, the type its command file declares. The editor sends only these, one command per change; a test holds
// this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddDomainEvent } from '../../../../lathe/src/authoring/domain-event/commands/add-domain-event';
import type { AddEventType } from '../../../../lathe/src/authoring/domain-event/commands/add-event-type';
import type { ChangeDomainEvent } from '../../../../lathe/src/authoring/domain-event/commands/change-domain-event';
import type { ChangeEventType } from '../../../../lathe/src/authoring/domain-event/commands/change-event-type';
import type { RemoveDomainEvent } from '../../../../lathe/src/authoring/domain-event/commands/remove-domain-event';
import type { RemoveEventType } from '../../../../lathe/src/authoring/domain-event/commands/remove-event-type';

/** Each command's route, with its input. */
export interface DomainEventCommands {
  '/api/domain-event/add-domain-event': AddDomainEvent;
  '/api/domain-event/add-event-type': AddEventType;
  '/api/domain-event/change-domain-event': ChangeDomainEvent;
  '/api/domain-event/change-event-type': ChangeEventType;
  '/api/domain-event/remove-domain-event': RemoveDomainEvent;
  '/api/domain-event/remove-event-type': RemoveEventType;
}

export type DomainEventRoute = keyof DomainEventCommands;

/** Sends one Domain event command through the shell's writer: its route and its input, typed by the route. */
export const sendDomainEvent = <R extends DomainEventRoute>(writer: Writer, route: R, input: DomainEventCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
