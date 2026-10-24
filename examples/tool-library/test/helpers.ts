// Shared test setup: a fresh in-memory store and a clock the test can move.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { LendingService } from '../src/lending-service.ts';
import { MemberService } from '../src/member-service.ts';
import { createRouter } from '../src/router.ts';
import { Store } from '../src/store.ts';
import { ToolService } from '../src/tool-service.ts';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const START = new Date('2026-03-02T10:00:00.000Z');

export class TestClock {
  current = new Date(START);
  now = (): Date => new Date(this.current);
  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * DAY_MS);
  }
  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Services over a fresh in-memory store, for domain rule tests. */
export function services() {
  const store = new Store();
  const clock = new TestClock();
  return {
    store,
    clock,
    members: new MemberService(store, clock.now),
    tools: new ToolService(store, clock.now),
    lending: new LendingService(store, clock.now),
  };
}

export interface Api {
  clock: TestClock;
  call(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }>;
  close(): Promise<void>;
}

/** The HTTP API on an ephemeral local port, for acceptance tests. */
export async function startApi(): Promise<Api> {
  const store = new Store();
  const clock = new TestClock();
  const server: Server = createServer(createRouter(store, clock.now));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    clock,
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
      store.close();
    },
  };
}
