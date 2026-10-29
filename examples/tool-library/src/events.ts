// The Lending domain's events and the outbox that delivers them.
// Spec: the event types TL-LEND-EV01-ET to EV06-ET (examples/tool-library/data/), each delivered by outbox.
// A command handler saves its events to the outbox table in the same transaction as its aggregate's change,
// then, once that transaction commits, runs the relay. The relay hands each undelivered event, oldest first,
// to the event handlers subscribed to it and marks it delivered when every one succeeds. A handler that fails
// is logged and leaves its event undelivered, for the next relay run: the reaction is never lost, and a handler
// may see an event more than once. This is eventual consistency, done in-process for the example, with no
// message broker.
// The outbox reads and writes only the outbox table (TL-LEND-TB01), which database.ts creates.
import type { Database, Row } from './database.ts';
import type { Clock, Condition } from './model.ts';

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
export type EventHandler<N extends EventName> = (event: Extract<DomainEvent, { type: N }>) => void;

/** Where a failing event handler is reported. */
export type HandlerFailure = (error: unknown, event: DomainEvent) => void;

const logFailure: HandlerFailure = (error, event) => {
  console.error(`An event handler for ${event.type} failed; the event stays in the outbox for the next relay run.`, error);
};

/** The outbox: saves events with their command's change, and relays them to their handlers after commit. */
export class Outbox {
  private readonly db: Database;
  private readonly now: Clock;
  private readonly onFailure: HandlerFailure;
  private readonly handlers = new Map<EventName, ((event: DomainEvent) => void)[]>();
  private relaying = false;

  constructor(db: Database, now: Clock, onFailure: HandlerFailure = logFailure) {
    this.db = db;
    this.now = now;
    this.onFailure = onFailure;
  }

  subscribe<N extends EventName>(name: N, handler: EventHandler<N>): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as (event: DomainEvent) => void);
    this.handlers.set(name, list);
  }

  /** Saves an event to the outbox table. Call it inside the transaction that changes its aggregate. */
  save(event: DomainEvent): void {
    this.db.sqlite
      .prepare('INSERT INTO outbox (type, event, raised_at) VALUES (?, ?, ?)')
      .run(event.type, JSON.stringify(event), this.now().toISOString());
  }

  /** Every event of the given types the outbox keeps, delivered or not, oldest first. */
  history<N extends EventName>(...names: N[]): Extract<DomainEvent, { type: N }>[] {
    const rows = this.db.sqlite
      .prepare(`SELECT event FROM outbox WHERE type IN (${names.map(() => '?').join(', ')}) ORDER BY id`)
      .all(...names) as Row[];
    return rows.map((r) => JSON.parse(String(r.event)) as Extract<DomainEvent, { type: N }>);
  }

  /**
   * The relay: delivers every undelivered event, oldest first, including those its handlers raise.
   * Call it after the raising transaction commits. A run tries each event once; one whose handler
   * fails stays undelivered until the next run. A call made while a run is going on (from a handler's
   * own command) leaves its events to that run.
   */
  relay(): void {
    if (this.relaying) return;
    this.relaying = true;
    try {
      let after = 0;
      for (let next = this.nextUndelivered(after); next; next = this.nextUndelivered(after)) {
        after = next.id;
        const event = JSON.parse(next.event) as DomainEvent;
        if (this.deliver(event)) {
          this.db.sqlite.prepare('UPDATE outbox SET delivered_at = ? WHERE id = ?').run(this.now().toISOString(), next.id);
        }
      }
    } finally {
      this.relaying = false;
    }
  }

  /** The oldest undelivered event after `afterId`. */
  private nextUndelivered(afterId: number): { id: number; event: string } | undefined {
    const r = this.db.sqlite
      .prepare('SELECT id, event FROM outbox WHERE delivered_at IS NULL AND id > ? ORDER BY id LIMIT 1')
      .get(afterId) as Row | undefined;
    return r && { id: Number(r.id), event: String(r.event) };
  }

  /** Hands the event to each of its handlers; false when one fails. */
  private deliver(event: DomainEvent): boolean {
    for (const handler of this.handlers.get(event.type) ?? []) {
      try {
        handler(event);
      } catch (error) {
        this.onFailure(error, event);
        return false;
      }
    }
    return true;
  }
}
