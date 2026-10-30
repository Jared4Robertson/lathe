// Storage tests: what the Lending database (TL-LEND-STORE01, the SQLite file DB names) keeps of a loan. Each test opens
// the database on a file in a fresh folder, as the server does with DB set, and closes and opens it again to restart.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Database } from '../src/database.ts';
import { borrowTool, returnTool } from '../src/loan-commands.ts';
import { registerMember } from '../src/member-commands.ts';
import { addTool } from '../src/tool-commands.ts';
import { DEFAULT_TIME_ZONE } from '../src/model.ts';
import { openLending } from '../src/router.ts';
import { TestClock } from './helpers.ts';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A database file in a fresh folder, and the Lending domain opened on it as the router opens it. */
function onFile(file = path.join(mkdtempSync(path.join(tmpdir(), 'tool-library-')), 'library.db')) {
  folders.push(path.dirname(file));
  const db = new Database(file);
  const clock = new TestClock();
  return { file, db, clock, ctx: openLending(db, clock.now, DEFAULT_TIME_ZONE) };
}

/** A member and a tool, each added through its command. */
function memberAndTool(ctx: ReturnType<typeof openLending>) {
  const member = registerMember(ctx, { name: 'Ada', email: 'ada@example.com' });
  const tool = addTool(ctx, { name: 'Drill' });
  return { member, tool };
}

describe('TL-LEND-A3-SR01 a loan is saved with its outbox event, or neither', () => {
  it('TL-LEND-A3-SR01-T01 a loan and its Loan opened event both survive a restart', () => {
    const first = onFile();
    const { member, tool } = memberAndTool(first.ctx);
    const loan = borrowTool(first.ctx, { memberId: member.id, toolId: tool.id });
    first.db.close();
    const again = onFile(first.file);
    expect(again.ctx.loans.get(loan.id)).toMatchObject({ id: loan.id, memberId: member.id, toolId: tool.id, return: null });
    expect(again.ctx.outbox.history('LoanOpened')).toEqual([expect.objectContaining({ loanId: loan.id, toolId: tool.id })]);
    again.db.close();
  });

  it('TL-LEND-A3-SR01-T02 a borrow whose event cannot be saved leaves no loan behind', () => {
    const { db, ctx } = onFile();
    const { member, tool } = memberAndTool(ctx);
    db.sqlite.exec('DROP TABLE outbox');
    expect(() => borrowTool(ctx, { memberId: member.id, toolId: tool.id })).toThrow();
    expect(ctx.loans.activeForTool(tool.id)).toBeUndefined();
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM loans').get()).toEqual({ n: 0 });
    db.close();
  });
});

describe('TL-LEND-A3-SR02 a loan is kept with its return', () => {
  it('TL-LEND-A3-SR02-T01 a returned loan, with its return, is still there after a restart', () => {
    const first = onFile();
    const { member, tool } = memberAndTool(first.ctx);
    const loan = borrowTool(first.ctx, { memberId: member.id, toolId: tool.id });
    first.clock.advanceDays(3);
    returnTool(first.ctx, loan.id, { condition: 'good', note: 'All fine.' });
    first.db.close();
    const again = onFile(first.file);
    expect(again.ctx.loans.get(loan.id).return).toMatchObject({ condition: 'good', note: 'All fine.' });
    again.db.close();
  });
});
