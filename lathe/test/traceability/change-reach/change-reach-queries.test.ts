// The Change reach read (LA-TRC-RM14, LA-TRC-QRY20): what a change of some records would touch, before it is made,
// worked out from the rows and the checks' chains through the read model's reader: every record that sits under the
// changed records or depends on them, followed on through what builds and proves each, grouped by stage with the path
// that reaches it; the files and tests it touches; and the purposes it could break.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { GET_REACH } from '../../../src/traceability/change-reach/queries.ts';
import type { ChangeReach, ReachRecord } from '../../../src/traceability/change-reach/read-model.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import type { ReadView } from '../../../src/platform/data/rules.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { loadWorkspace, openStore, type Store } from '../../../src/index.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { build, complete } from '../../helpers.ts';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TOOL_LIBRARY = path.join(REPO, 'examples', 'tool-library');

const open: Store[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

/** The product's rows with the checks' run, as the server gives a checked query. */
async function checkedView(root: string): Promise<ReadView> {
  const { problems, coverage, chains } = await loadWorkspace(root);
  const store = await openStore(root);
  open.push(store);
  return { schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id), checked: { problems, coverage, chains } };
}

const reach = (view: ReadView, ids: string[]) => runQuery(view, GET_REACH, { ids }) as ChangeReach;
const ids = (r: ChangeReach) => r.groups.flatMap((g) => g.records.map((x) => x.id));
const record = (r: ChangeReach, id: string): ReachRecord | undefined => r.groups.flatMap((g) => g.records).find((x) => x.id === id);

describe('LA-TRC-UC24-R01-T01 The reach of a change lists every record that sits under it or depends on it, each once, by stage, never up to a purpose', () => {
  it('reaches a command\'s endpoint, handler, steps and views with the path to each, and stops at the purposes', async () => {
    const r = reach(await checkedView(await build(complete())), ['EX-LEND-CMD01']);
    expect(r.changed).toEqual(['EX-LEND-CMD01']);
    expect(r.groups.map((g) => [g.label, g.records.map((x) => x.id)])).toEqual([
      ['Interaction design', ['EX-LEND-UC01-FL-S01', 'EX-V01', 'EX-LEND-EP01', 'EX-LEND-EP01-R01']],
      ['Technical specification', ['EX-LEND-CMD01-H', 'EX-UI01', 'EX-LEND-EP01-H']],
      ['Test plan', ['EX-LEND-EP01-R01-T01']],
    ]);
    expect(r.count).toBe(8);
    expect(record(r, 'EX-UI01')?.path).toEqual([{ id: 'EX-LEND-CMD01', via: null }, { id: 'EX-V01', via: 'Presents' }, { id: 'EX-UI01', via: 'Renders' }]);
    // A view reached through what it presents brings its components, not its own requirements.
    expect(ids(r)).not.toContain('EX-V01-R01');
    // Never up to the use case, capability or outcome it serves: those are its purposes.
    expect(ids(r).some((id) => /UC\d+$|CAP|BO/.test(id))).toBe(false);
  });

  it('follows a value object to the entity typed by it and on through what carries it out', async () => {
    const r = reach(await checkedView(await build(complete())), ['EX-VO01']);
    expect(record(r, 'EX-LEND-EN01')?.path.at(-1)).toEqual({ id: 'EX-LEND-EN01', via: 'Names in its type value object' });
    expect(ids(r)).toEqual(expect.arrayContaining(['EX-VO01-C01', 'EX-VO01-C01-T', 'EX-VO01-VT', 'EX-LEND-CMD01', 'EX-LEND-CMD01-H']));
    expect(new Set(ids(r)).size).toBe(ids(r).length);
  });

  it('follows a requirement to the steps that fulfill it and the technical records its chain says build it', async () => {
    const r = reach(await checkedView(await build(complete())), ['EX-LEND-UC01-R01']);
    expect(record(r, 'EX-LEND-UC01-FL-S01')?.path.at(-1)?.via).toBe('Fulfills');
    expect(record(r, 'EX-LEND-CMD01-H')?.path.at(-1)?.via).toBe('Builds');
    // An integration the chain counts as a provider is not built from the requirement.
    expect(ids(r).filter((id) => /^EX-INT\d+$/.test(id))).toEqual([]);
    expect(ids(r)).toContain('EX-INT01-AD');
  });

  it('on the Tool Library: a UC requirement touches its two steps, its command\'s handler and its test', async () => {
    const r = reach(await checkedView(TOOL_LIBRARY), ['TL-LEND-UC01-R01']);
    expect(ids(r)).toEqual(['TL-LEND-UC01-FL-S01', 'TL-LEND-UC01-FL-S03', 'TL-LEND-CMD01-H', 'TL-LEND-UC01-R01-T01']);
  }, 60_000);
});

describe('LA-TRC-UC24-R02-T01 The reach names the code files and the tests a change touches, each test with its state', () => {
  it('names each file with the records naming it, and each test with its state and file', async () => {
    const r = reach(await checkedView(await build(complete())), ['EX-LEND-CMD01']);
    expect(r.files).toEqual([
      { path: 'src/loans.ts', records: ['EX-LEND-CMD01-H'] },
      { path: 'src/router.ts', records: ['EX-LEND-EP01-H'] },
      { path: 'test/api.test.ts', records: ['EX-LEND-EP01-R01-T01'] },
      { path: 'web/catalog.tsx', records: ['EX-UI01'] },
    ]);
    expect(record(r, 'EX-LEND-EP01-R01-T01')).toMatchObject({ state: 'automated', file: 'test/api.test.ts' });
    expect(record(r, 'EX-LEND-CMD01-H')).toMatchObject({ state: null, file: 'src/loans.ts' });
    expect(GET_REACH.text(r)).toContain('EX-LEND-EP01-R01-T01 (automated, test/api.test.ts) sits under EX-LEND-EP01-R01, which sits under EX-LEND-EP01, which sits under EX-LEND-CMD01');
  });
});

describe('LA-TRC-UC24-R03-T01 The reach names the use cases, journeys and business outcomes its records serve', () => {
  it('names the purposes of a command\'s reach, and none for an outcome no use case reaches', async () => {
    const view = await checkedView(await build(complete()));
    expect(reach(view, ['EX-LEND-CMD01']).purposes).toEqual({ useCases: ['EX-LEND-UC01', 'EX-LEND-UC02'], journeys: [], outcomes: ['EX-BO01'] });
    const outcome = reach(view, ['EX-BO01']);
    expect(outcome).toMatchObject({ count: 0, groups: [], purposes: { useCases: [], journeys: [], outcomes: [] } });
    expect(GET_REACH.text(outcome)).toContain('none: no use case reaches these records');
  });
});

describe('LA-TRC-UC24-R04-T01 A change of several records reads as one reach, each record once with the changed records it is reached from', () => {
  it('reads two records as one reach, and dropping one leaves what only it reached', async () => {
    const view = await checkedView(await build(complete()));
    const both = reach(view, ['EX-LEND-CMD01', 'EX-LEND-UC01-R01']);
    expect(new Set(ids(both)).size).toBe(ids(both).length);
    expect(record(both, 'EX-LEND-UC01-FL-S01')?.from).toEqual(['EX-LEND-CMD01', 'EX-LEND-UC01-R01']);
    expect(record(both, 'EX-LEND-EP01')?.from).toEqual(['EX-LEND-CMD01']);
    expect(record(both, 'EX-LEND-UC01-FL-S02')?.from).toEqual(['EX-LEND-UC01-R01']);
    const one = reach(view, ['EX-LEND-UC01-R01']);
    expect(ids(both).filter((id) => !ids(one).includes(id))).toEqual(expect.arrayContaining(['EX-LEND-EP01', 'EX-V01', 'EX-UI01']));
    // A changed record another changed record reaches is the change, not what it touches.
    expect(ids(reach(view, ['EX-LEND-CMD01', 'EX-LEND-CMD01-H']))).not.toContain('EX-LEND-CMD01-H');
  });
});

describe('LA-TRC-UC24-R05-T01 An Agent reads the same reach through its MCP tool, and an unknown record or an empty change is refused', () => {
  it('answers the tool with the query\'s own text and refuses what the data does not hold', async () => {
    const view = await checkedView(TOOL_LIBRARY);
    const tool = await callTool(TOOL_LIBRARY, 'change_reach_get_reach', { ids: ['TL-LEND-UC01-R01'] });
    expect(tool.isError).toBeFalsy();
    expect(tool.content[0].text).toBe(GET_REACH.text(reach(view, ['TL-LEND-UC01-R01'])));
    expect(() => reach(view, ['TL-NONE'])).toThrow(StoreError);
    expect(() => reach(view, [])).toThrow(StoreError);
  }, 60_000);
});

describe("LA-TRC-RM14-SR01-T01 The reach of a change of a whole domain of Lathe's own spec is worked out well within its budget", () => {
  it('reads the reach of the Traceability domain over the rows in under a second (the budget is 200 ms on a warm store)', async () => {
    const store = await openStore(REPO);
    open.push(store);
    const view: ReadView = { schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id), checked: { problems: [], coverage: [], chains: [] } };
    reach(view, ['LA-TRC-UC24']);
    const started = performance.now();
    const r = reach(view, ['LA-TRC']);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(r.count).toBeGreaterThan(100);
  }, 60_000);
});
