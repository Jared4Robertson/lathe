import type { ServedData } from '../test/read-view';
// What the flow tests in the stability suite share: the served workspace, as the app reads it, so a
// flow can check the page against the figures the engine worked out.
import type { Page } from '@playwright/test';

/** The workspace the dev server serves now (GET /api/spec). */
export async function served(page: Page): Promise<ServedData> {
  const answer = await page.request.get('/api/spec');
  if (!answer.ok()) throw new Error(`GET /api/spec answered ${answer.status()}`);
  return (await answer.json()) as ServedData;
}

/** The rows of one stored table, from every product folder. */
export const rowsOf = (spec: ServedData, table: string) => spec.sources.flatMap((source) => source.tables[table] ?? []);

/** "12 automated, 1 manual, 2 not automated yet", as the app words a domain's tests by state. */
export const testsText = (t: { automated: number; manual: number; not_automated: number }) => `${t.automated} automated, ${t.manual} manual, ${t.not_automated} not automated yet`;
