// What the flow tests in the stability suite share: the served workspace, as the app reads it, so a
// flow can check the page against the figures the engine worked out.
import type { Page } from '@playwright/test';
import type { SpecData } from '../../lathe/src/server/contract';

/** The workspace the dev server serves now (GET /api/spec). */
export async function served(page: Page): Promise<SpecData> {
  const answer = await page.request.get('/api/spec');
  if (!answer.ok()) throw new Error(`GET /api/spec answered ${answer.status()}`);
  return (await answer.json()) as SpecData;
}

/** The rows of one stored table. */
export const rowsOf = (spec: SpecData, table: string) => spec.tables[table] ?? [];

/** "12 automated, 1 manual, 2 not automated yet", as the app words a domain's tests by state. */
export const testsText = (t: { automated: number; manual: number; not_automated: number }) => `${t.automated} automated, ${t.manual} manual, ${t.not_automated} not automated yet`;
