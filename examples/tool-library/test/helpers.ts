// Shared test setup: a fresh in-memory database and a clock the test can move.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Database } from '../src/database.ts';
import { subscribePolicies } from '../src/event-handlers.ts';
import type { DomainEvent, HandlerFailure } from '../src/events.ts';
import { DEFAULT_TIME_ZONE } from '../src/model.ts';
import { createRouter, openLending } from '../src/router.ts';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** 05:00 on Monday 2 March 2026 in New York (EST), the library's default time zone. */
export const START = new Date('2026-03-02T10:00:00.000Z');
/** A loan started at START is due on this date (14 calendar days later). */
export const START_DUE_DATE = '2026-03-16';
/** 23:59 on the due date in New York (EDT, UTC-4): UTC is already on the next day. */
export const LAST_MINUTE_OF_DUE_DATE = '2026-03-17T03:59:00.000Z';
/** 00:00 on the day after the due date in New York. */
export const START_OF_NEXT_DAY = '2026-03-17T04:00:00.000Z';

export class TestClock {
  current = new Date(START);
  now = (): Date => new Date(this.current);
  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * DAY_MS);
  }
  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(iso: string): void {
    this.current = new Date(iso);
  }
}

export interface LendingOptions {
  /** The library's time zone; the default unless given. */
  timeZone?: string;
  /** Whether the policies' event handlers are subscribed, as the router subscribes them. Default true. */
  policies?: boolean;
  /** Where a failing event handler is reported; the outbox logs it unless given. */
  onFailure?: HandlerFailure;
}

/**
 * The Lending domain over a fresh in-memory database, for domain rule tests, opened as the router opens it.
 * `delivered` lists every event the relay handed to its handlers, in order.
 */
export function lending(options: LendingOptions = {}) {
  const db = new Database();
  const clock = new TestClock();
  const ctx = openLending(db, clock.now, options.timeZone ?? DEFAULT_TIME_ZONE, options.onFailure);
  const delivered: DomainEvent[] = [];
  for (const name of ['MemberRegistered', 'ToolAdded', 'DamageReported', 'ToolRepaired', 'LoanOpened', 'ToolReturned'] as const) {
    ctx.outbox.subscribe(name, (event) => delivered.push(event));
  }
  if (options.policies ?? true) subscribePolicies(ctx.outbox, ctx);
  return { ...ctx, clock, delivered };
}

export interface Api {
  clock: TestClock;
  /** The local port the API listens on, for tests that send raw requests. */
  port: number;
  call(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }>;
  close(): Promise<void>;
}

/** The HTTP API on an ephemeral local port, for acceptance tests, in the default time zone. */
export async function startApi(): Promise<Api> {
  const db = new Database();
  const clock = new TestClock();
  const server: Server = createServer(createRouter(db, clock.now, { timeZone: DEFAULT_TIME_ZONE }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    clock,
    port,
    async call(method, path, body) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    },
    async close() {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      db.close();
    },
  };
}
