// The Aggregate queries pattern (LA-PAT-AGGREGATE-QUERIES), proved in each domain that follows it: every query of the
// domain is named on its own on every interface (R01), asking changes nothing (R03), an ID that names nothing is
// refused with a reason that names it (R04), and a read model is current with the records it reads after a write
// (R05). That a query answers from its read model alone (R02) is the static guard in command-layers.test.ts.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ALL_COMMANDS, ALL_QUERIES } from '../src/commands.ts';
import { openStore, type Store } from '../src/index.ts';
import { answerQuery } from '../src/platform/commands/run.ts';
import { toolName, type AnyQuery } from '../src/platform/commands/definition.ts';
import { removeData, run, writeData } from './helpers.ts';
import { everyKind } from './store/fixture.ts';

afterAll(removeData);

const queriesOf = (domain: string) => ALL_QUERIES.filter((q) => q.id.startsWith(`${domain}-QRY`));

const required = (query: AnyQuery) => Object.entries(query.input).filter(([, field]) => field.required).map(([name]) => name);

/** The input a query is asked with over the fixture: none, the product alone, or null when it needs a record named. */
const plainInput = (query: AnyQuery): Record<string, unknown> | null => {
  const names = required(query);
  if (names.length === 0) return {};
  if (names.length === 1 && names[0] === 'product_id') return { product_id: 'TL' };
  return null;
};

/** Each plain query of the domain answered over the store, or its refusal's reason. */
function answers(store: Store, domain: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const query of queriesOf(domain)) {
    const input = plainInput(query);
    if (query.checked || query.baseline || !input) continue;
    try {
      out[query.id] = answerQuery(store, query, input);
    } catch (error) {
      out[query.id] = { refused: (error as Error).message };
    }
  }
  return out;
}

/** The data files, by name, as text. */
const filesOf = (root: string) => {
  const dir = path.join(root, 'data');
  return new Map(readdirSync(dir).map((f) => [f, readFileSync(path.join(dir, f), 'utf8')]));
};

/** Each of the domain's queries is named on its own on every interface: its ID, CLI command, MCP tool and route. */
function namedOnItsOwn(domain: string): void {
  const queries = queriesOf(domain);
  expect(queries.length).toBeGreaterThan(0);
  const all = [...ALL_COMMANDS, ...ALL_QUERIES];
  for (const key of [(d: (typeof all)[number]) => d.id, (d: (typeof all)[number]) => `lathe ${d.slice.name} ${d.name}`, toolName, (d: (typeof all)[number]) => d.route]) {
    const names = all.map(key);
    expect(queries.filter((q) => names.filter((n) => n === key(q)).length !== 1).map((q) => q.id)).toEqual([]);
  }
  for (const q of queries) expect(`${q.method} ${q.route}`, q.id).toBe(`GET /api/${q.slice.name}/${q.name}`);
}

/** Asking each of the domain's queries changes no row and no data file. */
async function changesNothing(domain: string): Promise<void> {
  const root = writeData(everyKind());
  const before = filesOf(root);
  const store = await openStore(root);
  try {
    const rows = (s: Store) => Object.values(s.schema.tables).filter((t) => t.stored).map((t) => [t.name, s.rows(t.name)]);
    const held = JSON.stringify(rows(store));
    answers(store, domain);
    for (const query of queriesOf(domain).filter((q) => !plainInput(q) && required(q).length === 1 && required(q)[0] === 'id')) {
      try {
        answerQuery(store, query, { id: 'TL-LEND-A1' });
      } catch {
        // A refusal is an answer too; what matters is that nothing changed.
      }
    }
    expect(JSON.stringify(rows(store))).toBe(held);
    expect(filesOf(root)).toEqual(before);
  } finally {
    await store.close();
  }
}

/** Each of the domain's queries asked by an ID that names nothing is refused with a reason that names it. */
async function refusesWhatItCannotFind(domain: string): Promise<void> {
  const store = await openStore(writeData(everyKind()));
  try {
    // Each query whose every required field names a record, asked with an ID that names none.
    const naming = queriesOf(domain).filter((q) => !q.checked && !q.baseline && required(q).length > 0 && required(q).every((name) => q.input[name].kind === 'id'));
    const missing = 'TL-NONE-X99';
    const answered: string[] = [];
    for (const query of naming) {
      try {
        answerQuery(store, query, Object.fromEntries(required(query).map((name) => [name, missing])));
        answered.push(query.id);
      } catch (error) {
        expect((error as Error).message, query.id).toContain(missing);
      }
    }
    expect(answered).toEqual([]);
    // A domain whose queries name no record, such as Platform's meta-model, has nothing to find: each takes no input.
    if (!naming.length) expect(queriesOf(domain).filter((q) => required(q).length > 0).map((q) => q.id)).toEqual([]);
  } finally {
    await store.close();
  }
}

/** After a write, each of the domain's read models answers as it does over the data loaded afresh. */
async function staysCurrent(domain: string): Promise<void> {
  const root = writeData(everyKind());
  const store = await openStore(root);
  try {
    // The readers are made on the data as loaded, then the write changes what they read.
    answers(store, domain);
    await run(store, 'aggregate change-aggregate', { id: 'TL-LEND-A2', title: 'Library tool', description: 'A tool the library holds and lends.' });
    const kept = answers(store, domain);
    const fresh = await openStore(root);
    try {
      expect(kept).toEqual(answers(fresh, domain));
    } finally {
      await fresh.close();
    }
  } finally {
    await store.close();
  }
}

describe('Authoring follows Aggregate queries', () => {
  it('LA-PAT-AGGREGATE-QUERIES-R01-T01 each Authoring query is named on its own on every interface', () => namedOnItsOwn('LA-AUT'));
  it('LA-PAT-AGGREGATE-QUERIES-R03-T01 asking each Authoring query changes no row and no data file', () => changesNothing('LA-AUT'));
  it('LA-PAT-AGGREGATE-QUERIES-R04-T01 each Authoring query asked by an ID that names nothing is refused, naming it', () => refusesWhatItCannotFind('LA-AUT'));
  it('LA-PAT-AGGREGATE-QUERIES-R05-T01 after a write, each Authoring read model answers as it does over the data loaded afresh', () => staysCurrent('LA-AUT'));
});

describe('Checking follows Aggregate queries', () => {
  it('LA-PAT-AGGREGATE-QUERIES-R01-T02 each Checking query is named on its own on every interface', () => namedOnItsOwn('LA-CHK'));
  it('LA-PAT-AGGREGATE-QUERIES-R03-T02 asking each Checking query changes no row and no data file', () => changesNothing('LA-CHK'));
  it('LA-PAT-AGGREGATE-QUERIES-R04-T02 each Checking query asked by an ID that names nothing is refused, naming it', () => refusesWhatItCannotFind('LA-CHK'));
  it('LA-PAT-AGGREGATE-QUERIES-R05-T02 after a write, each Checking read model answers as it does over the data loaded afresh', () => staysCurrent('LA-CHK'));
});

describe('Exploring follows Aggregate queries', () => {
  it('LA-PAT-AGGREGATE-QUERIES-R01-T03 each Exploring query is named on its own on every interface', () => namedOnItsOwn('LA-EXP'));
  it('LA-PAT-AGGREGATE-QUERIES-R03-T03 asking each Exploring query changes no row and no data file', () => changesNothing('LA-EXP'));
  it('LA-PAT-AGGREGATE-QUERIES-R04-T03 each Exploring query asked by an ID that names nothing is refused, naming it', () => refusesWhatItCannotFind('LA-EXP'));
  it('LA-PAT-AGGREGATE-QUERIES-R05-T03 after a write, each Exploring read model answers as it does over the data loaded afresh', () => staysCurrent('LA-EXP'));
});

describe('Platform follows Aggregate queries', () => {
  it('LA-PAT-AGGREGATE-QUERIES-R01-T04 each Platform query is named on its own on every interface', () => namedOnItsOwn('LA-PLT'));
  it('LA-PAT-AGGREGATE-QUERIES-R03-T04 asking each Platform query changes no row and no data file', () => changesNothing('LA-PLT'));
  it('LA-PAT-AGGREGATE-QUERIES-R04-T04 each Platform query asked by an ID that names nothing is refused, naming it', () => refusesWhatItCannotFind('LA-PLT'));
  it('LA-PAT-AGGREGATE-QUERIES-R05-T04 after a write, each Platform read model answers as it does over the data loaded afresh', () => staysCurrent('LA-PLT'));
});

describe('Traceability follows Aggregate queries', () => {
  it('LA-PAT-AGGREGATE-QUERIES-R01-T05 each Traceability query is named on its own on every interface', () => namedOnItsOwn('LA-TRC'));
  it('LA-PAT-AGGREGATE-QUERIES-R03-T05 asking each Traceability query changes no row and no data file', () => changesNothing('LA-TRC'));
  it('LA-PAT-AGGREGATE-QUERIES-R04-T05 each Traceability query asked by an ID that names nothing is refused, naming it', () => refusesWhatItCannotFind('LA-TRC'));
  it('LA-PAT-AGGREGATE-QUERIES-R05-T05 after a write, each Traceability read model answers as it does over the data loaded afresh', () => staysCurrent('LA-TRC'));
});
