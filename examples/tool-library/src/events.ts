// The Lending domain's events and the in-process dispatcher that publishes them.
// Spec: the event types TL-LEND-EV01-ET to EV06-ET (examples/tool-library/data/).
// A command handler raises its events and publishes them only after its transaction commits.
// The dispatcher calls each subscribed event handler synchronously, in the order subscribed. An event
// handler that fails is logged and never undoes the command that raised the event: this is eventual
// consistency, done in-process for the example, with no message broker.
import type { Condition } from './model.ts';

/** TL-LEND-EV01-ET: a librarian registered a new member. */
export interface MemberRegistered {
  type: 'MemberRegistered';
  memberId: number;
  name: string;
  email: string;
  joinedAt: string;
}

/** TL-LEND-EV02-ET: a librarian added a tool to the catalog. */
export interface ToolAdded {
  type: 'ToolAdded';
  toolId: number;
  name: string;
  /** Empty when the tool has none. */
  description: string;
  addedAt: string;
}

/** TL-LEND-EV03-ET: a tool was marked as needing repair. */
export interface DamageReported {
  type: 'DamageReported';
  toolId: number;
  note: string;
  reportedAt: string;
}

/** TL-LEND-EV04-ET: a librarian marked a damaged tool repaired. */
export interface ToolRepaired {
  type: 'ToolRepaired';
  toolId: number;
  repairedAt: string;
}

/** TL-LEND-EV05-ET: a member borrowed a tool. */
export interface LoanOpened {
  type: 'LoanOpened';
  loanId: number;
  memberId: number;
  toolId: number;
  borrowedAt: string;
  /** YYYY-MM-DD, in the library's time zone. */
  dueDate: string;
}

/** TL-LEND-EV06-ET: a librarian recorded a tool's return, which closes its loan. */
export interface ToolReturned {
  type: 'ToolReturned';
  loanId: number;
  memberId: number;
  toolId: number;
  returnedAt: string;
  condition: Condition;
  note: string | null;
  late: boolean;
}

export type DomainEvent = MemberRegistered | ToolAdded | DamageReported | ToolRepaired | LoanOpened | ToolReturned;
export type EventName = DomainEvent['type'];
export type EventOf<N extends EventName> = Extract<DomainEvent, { type: N }>;
export type EventHandler<N extends EventName> = (event: EventOf<N>) => void;

/** Where a failing event handler is reported. */
export type HandlerFailure = (error: unknown, event: DomainEvent) => void;

const logFailure: HandlerFailure = (error, event) => {
  console.error(`An event handler for ${event.type} failed; the command that raised it still stands.`, error);
};

/** Publishes domain events to the event handlers subscribed to them, in this process. */
export class EventDispatcher {
  private readonly handlers = new Map<EventName, ((event: DomainEvent) => void)[]>();
  private readonly onFailure: HandlerFailure;

  constructor(onFailure: HandlerFailure = logFailure) {
    this.onFailure = onFailure;
  }

  subscribe<N extends EventName>(name: N, handler: EventHandler<N>): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as (event: DomainEvent) => void);
    this.handlers.set(name, list);
  }

  /** Calls every handler of each event, in order. Call it only once the raising transaction has committed. */
  publish(...events: DomainEvent[]): void {
    for (const event of events) {
      for (const handler of this.handlers.get(event.type) ?? []) {
        try {
          handler(event);
        } catch (error) {
          this.onFailure(error, event);
        }
      }
    }
  }
}
