// Owed and silent proofs: proof-still-owed names each proved obligation a planned test still owes,
// proof-counts-nowhere reports a test whose proof no domain counts, and manual-test-file-silent reports a manual
// test whose file never mentions it. The owed-silent-main fixture declares a proof relation of its own, shows, that
// reaches a note (not an obligation) and a promise (an obligation of the whole product, outside every domain).
import { beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { load } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const messagesOf = (ws: Workspace, check: string, record: string) =>
  ws.problems.filter((p) => p.check === check && p.record === record).map((p) => p.message).sort();

const NEW_CHECKS = ['proof-still-owed', 'proof-counts-nowhere', 'manual-test-file-silent'];
const NOWHERE_FIX = ' Prove what the test\'s domain owes, or move the test into a domain that owes what it proves.';
const SILENT_FIX = '; name the test in the file, or point its file at the one that carries it out.';

let main: Workspace;
beforeAll(async () => {
  main = await load('owed-silent-main');
});

describe('proof still owed', () => {
  it('LA-TRC-T65 A proved obligation that a planned test is also meant to prove is named, with that test', () => {
    expect(messagesOf(main, 'proof-still-owed', 'OS-A-UC01-R01')).toEqual([
      'Requirement OS-A-UC01-R01 is proved, but planned test OS-A-T02 still owes a proof of it; write that test, or drop its proves link to OS-A-UC01-R01.',
    ]);
    // Proof by a manual test counts as proof too.
    expect(messagesOf(main, 'proof-still-owed', 'OS-A-UC01-R02')).toEqual([
      'Requirement OS-A-UC01-R02 is proved, but planned test OS-A-T02 still owes a proof of it; write that test, or drop its proves link to OS-A-UC01-R02.',
    ]);
    // R04 is proved and no planned test is meant to prove it.
    expect(recordsOf(main, 'proof-still-owed')).not.toContain('OS-A-UC01-R04');
  });

  it('LA-TRC-T66 A pattern rule owes proof only in the domain whose own planned test is meant to prove it', () => {
    // OS-A-T04 (planned, in A) is meant to prove OS-PAT-R01, which OS-A-T01 proves in A; OS-B proves it with no planned test.
    expect(messagesOf(main, 'proof-still-owed', 'OS-PAT-R01')).toEqual([
      'Pattern rule OS-PAT-R01 is proved in OS-A, but planned test OS-A-T04 there still owes a proof of it; write that test, or drop its proves link to OS-PAT-R01.',
    ]);
  });

  it('LA-TRC-T67 An obligation not yet proved, whose test is only planned, is unproved rather than proof-still-owed', () => {
    expect(recordsOf(main, 'proof-still-owed')).not.toContain('OS-A-UC01-R03');
    expect(messagesOf(main, 'unproved', 'OS-A-UC01-R03')).toEqual([
      'No test proves requirement OS-A-UC01-R03 yet: its test is only planned.',
    ]);
  });

  it('LA-TRC-T68 proof-still-owed names exactly the obligations planned_any counts beyond planned, in every fixture', async () => {
    const names = ['owed-silent-main', 'owed-proof', 'coverage-states', 'good', 'unfinished'];
    const workspaces = await Promise.all(names.map(load));
    for (const ws of workspaces) {
      const counted = ws.coverage.reduce((n, c) => n + c.obligations.reduce((m, o) => m + o.planned_any - o.planned, 0), 0);
      const named = new Set(
        ws.problems.filter((p) => p.check === 'proof-still-owed').map((p) => `${p.record}${/ is proved( in \S+)?,/.exec(p.message)![1] ?? ''}`),
      );
      expect(named.size).toBe(counted);
    }
  });
});

describe('proof that counts nowhere', () => {
  it('LA-TRC-T69 A test proving only a rule of a pattern nobody follows is reported', () => {
    expect(messagesOf(main, 'proof-counts-nowhere', 'OS-A-T05')).toEqual([
      'Test OS-A-T05\'s proof counts in no domain\'s coverage: OS-PAT2-R01 is owed by no domain: no use case follows its pattern OS-PAT2.' + NOWHERE_FIX,
    ]);
  });

  it('LA-TRC-T70 A test proving a pattern rule only another domain owes is reported; one in a domain that follows the pattern itself is not', () => {
    expect(messagesOf(main, 'proof-counts-nowhere', 'OS-A-T06')).toEqual([
      'Test OS-A-T06\'s proof counts in no domain\'s coverage: OS-PAT3-R01 is owed only by OS-B, not by OS-A, where the test sits.' + NOWHERE_FIX,
    ]);
    // OS-B follows OS-PAT3 itself, so OS-B-T02's proof counts there.
    expect(recordsOf(main, 'proof-counts-nowhere')).not.toContain('OS-B-T02');
  });

  it('LA-TRC-T71 Each target is named with its reason, and a planned test is judged too', () => {
    expect(messagesOf(main, 'proof-counts-nowhere', 'OS-A-T07')).toEqual([
      'Test OS-A-T07\'s proof counts in no domain\'s coverage: OS-A-N1 is not an obligation; OS-PR01 sits in no domain.' + NOWHERE_FIX,
    ]);
    expect(messagesOf(main, 'proof-counts-nowhere', 'OS-A-T09')).toEqual([
      'Test OS-A-T09\'s proof counts in no domain\'s coverage: OS-PR01 sits in no domain.' + NOWHERE_FIX,
    ]);
  });

  it('LA-TRC-T72 A test proving a rule that every following use case marks not applicable is reported', () => {
    expect(messagesOf(main, 'proof-counts-nowhere', 'OS-C-T01')).toEqual([
      'Test OS-C-T01\'s proof counts in no domain\'s coverage: OS-PAT4-R01 is owed by no domain: wherever OS-PAT4 is followed, its setting is not applicable or no follower meets its applies-when setting.' + NOWHERE_FIX,
    ]);
  });

  it('LA-TRC-T73 A test with at least one proof that counts is not reported', () => {
    // OS-A-T08 proves OS-PAT2-R01 (counted nowhere) and OS-A-UC01-R04 (counted in OS-A).
    expect(recordsOf(main, 'proof-counts-nowhere')).toEqual(['OS-A-T05', 'OS-A-T06', 'OS-A-T07', 'OS-A-T09', 'OS-C-T01']);
  });
});

describe('manual test whose file is silent', () => {
  it('LA-TRC-T74 A manual test whose file names neither its ID, nor an ID it proves, nor its key is reported', () => {
    expect(messagesOf(main, 'manual-test-file-silent', 'OS-A-T10')).toEqual([
      'Manual test OS-A-T10 names the file code/manual-silent.md, but that file names neither OS-A-T10 nor any ID it proves' + SILENT_FIX,
    ]);
    expect(messagesOf(main, 'manual-test-file-silent', 'OS-A-T13')).toEqual([
      'Manual test OS-A-T13 names the file code/manual-silent.md, but that file names neither OS-A-T13 nor any ID it proves nor its key "return-by-hand"' + SILENT_FIX,
    ]);
  });

  it('LA-TRC-T75 A file naming the test, an ID it proves or its key is enough, and only manual tests are judged', () => {
    // T03's file names T03, T11's names the ID it proves, T12's holds its key; T04 is planned and shares T10's silent file.
    expect(recordsOf(main, 'manual-test-file-silent')).toEqual(['OS-A-T10', 'OS-A-T13']);
  });
});

describe('the three warnings', () => {
  it('LA-CHK-T31 Owed and silent proofs are warnings, never errors, and a workspace without them has none', async () => {
    expect(main.problems.filter((p) => p.severity === 'error')).toEqual([]);
    for (const check of NEW_CHECKS) {
      const found = main.problems.filter((p) => p.check === check);
      expect(found.length).toBeGreaterThan(0);
      expect(found.every((p) => p.severity === 'warning')).toBe(true);
    }
    const good = await load('good');
    expect(good.problems.filter((p) => NEW_CHECKS.includes(p.check))).toEqual([]);
  });
});
