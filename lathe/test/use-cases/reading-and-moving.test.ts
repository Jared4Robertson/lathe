// What the Owner does before and around a change, proved per use case over one product with a record of every kind:
// finding a record among its parent's and reading it whole, moving a record to another domain, changing and removing
// a storage requirement or a data store, reading who follows a pattern, filling a slot by hand, and a load the store
// refuses. Each describe names the use case test it is.
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ALL_COMMANDS, ALL_QUERIES } from '../../src/commands.ts';
import { loadWorkspace } from '../../src/index.ts';
import { answerQuery, runCommand, runCommands } from '../../src/platform/commands/run.ts';
import { StoreError } from '../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../src/platform/data/store.ts';
import { everyKind, writeData, type Data } from '../store/fixture.ts';
import { adding } from '../helpers.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

const command = (name: string) => ALL_COMMANDS.find((c) => `${c.slice.name} ${c.name}` === name)!;

/** TL with a second domain to move records to, a product kind under a domain, and a data store of the lending domain. */
const data = (): Data =>
  adding(everyKind(), {
    domain: [{ id: 'TL-CAT', title: 'Catalog', product_id: 'TL', position: 2, subdomain_type: 'supporting', description: 'The tools the library holds.' }],
    product_kind: [{ name: 'shared_module', product_id: 'TL', label: 'Shared module', description: 'Code several records use.', parent_kind: 'domain', stage: 'technical-specification', obligation: false, complexity: 'accidental', id_pattern: '<P>-<D>-MOD<nn>' }],
    shared_module: [{ id: 'TL-LEND-MOD01', title: 'dates.ts', domain_id: 'TL-LEND' }],
    data_store: [{ id: 'TL-LEND-STORE02', title: 'loanCache', domain_id: 'TL-LEND', kind: 'memory', description: 'Loans kept while the desk app runs.' }],
  });

async function storeOf(): Promise<Store> {
  const store = await openStore(writeData(data()), { latheDataDir: null });
  open.push(store);
  return store;
}

/** The query's answer over the store, the query named by its ID. */
function ask(store: Store, id: string, input: Record<string, unknown>): any {
  const query = ALL_QUERIES.find((q) => q.id === id);
  if (!query) throw new Error(`no query ${id}`);
  return answerQuery(store, query, input);
}

/** The IDs of the records listed, or of the use cases listed under each group. */
const ids = (rows: { id?: string; useCases?: { id: string }[] }[]) => rows.flatMap((r) => (r.useCases ? r.useCases.map((u) => u.id) : [r.id]));

/**
 * Each use case test that finds a record among its parent's and reads it whole: the listing query and its input (none
 * where the use case reads its record straight from the product), the record listed, the reading query, and what the
 * whole record holds.
 */
const READS: { test: string; list?: [string, Record<string, unknown>]; listed?: string; read: [string, Record<string, unknown>]; holds: (whole: any) => void }[] = [
  {
    test: 'LA-PRD-UC04-R07-T01', read: ['LA-PRD-QRY110', { id: 'TL' }],
    holds: (w) => {
      expect(w.kinds.find((k: any) => k.name === 'cli_command')?.fields.length).toBeGreaterThan(0);
      expect(w).toHaveProperty('relations');
    },
  },
  {
    test: 'LA-PRD-UC22-R05-T01', list: ['LA-PRD-QRY116', { product_id: 'TL' }], listed: 'TL-BO01', read: ['LA-PRD-QRY115', { id: 'TL-BO01' }],
    holds: (w) => expect(w).toMatchObject({ outcome: { id: 'TL-BO01' }, servedBy: [{ id: 'TL-LEND-A1', kind: 'aggregate', title: 'Loan' }], measuredBy: ['TL-LEND-DS01-T01'] }),
  },
  { test: 'LA-PRD-UC23-R02-T01', read: ['LA-PRD-QRY110', { id: 'TL' }], holds: (w) => expect(ids(w.interfaces)).toContain('TL-IF01') },
  {
    test: 'LA-PRD-UC33-R10-T01', read: ['LA-PRD-QRY228', { id: 'TL-JR01' }],
    holds: (w) => expect(w.paths[0]).toMatchObject({ name: 'main', steps: [{ step: { id: 'TL-JR01-S01' }, carriesOut: { kind: 'policy', id: 'TL-LEND-PO01' } }] }),
  },
  {
    test: 'LA-PRD-UC34-R02-T01', list: ['LA-PRD-QRY119', { kind: 'shared_module', parent: 'TL-LEND' }], listed: 'TL-LEND-MOD01', read: ['LA-PRD-QRY118', { id: 'TL-LEND-MOD01' }],
    holds: (w) => expect(w).toMatchObject({ id: 'TL-LEND-MOD01', kind: 'shared_module', parent: 'TL-LEND', values: { title: 'dates.ts' }, links: {} }),
  },
  { test: 'LA-PRD-UC35-R02-T01', read: ['LA-PRD-QRY110', { id: 'TL' }], holds: (w) => expect(w.roles.map((r: any) => r.name)).toEqual(['Librarian', 'Member']) },
  {
    test: 'LA-PRD-UC36-R02-T01', read: ['LA-PRD-QRY110', { id: 'TL' }],
    holds: (w) => expect(JSON.stringify(w.questions)).toMatch(/TL-LEND-Q01[\s\S]*TL-LEND-UC01/),
  },
  {
    test: 'LA-MOD-UC02-R11-T01', read: ['LA-MOD-QRY130', { id: 'TL-LEND' }],
    holds: (w) => {
      expect(w.useCases[0]).toMatchObject({ group: { id: 'TL-LEND-A1', kind: 'aggregate' }, useCases: ['TL-LEND-UC01'] });
      expect(w.terms.map((t: any) => t.term.id)).toEqual(['TL-LEND-TM01', 'TL-LEND-TM02']);
      expect(w.domainServices[0]).toMatchObject({ domainService: { id: 'TL-LEND-DS01' } });
    },
  },
  {
    test: 'LA-MOD-UC10-R81-T01', list: ['LA-MOD-QRY151', { domain_id: 'TL-LEND' }], listed: 'TL-LEND-A1', read: ['LA-MOD-QRY150', { id: 'TL-LEND-A1' }],
    holds: (w) => {
      expect(w.entities.map((e: any) => e.entity.id)).toEqual(['TL-LEND-EN01', 'TL-LEND-EN02']);
      expect(w.entities[0].fields.length).toBeGreaterThan(0);
      expect(JSON.stringify(w)).toContain('TL-LEND-INV01');
    },
  },
  {
    test: 'LA-MOD-UC12-R08-T01', list: ['LA-MOD-QRY160', { entity_id: 'TL-LEND-EN01' }], listed: 'TL-LEND-CMD01', read: ['LA-MOD-QRY159', { id: 'TL-LEND-CMD01' }],
    holds: (w) => expect(w).toMatchObject({ raises: ['TL-LEND-EV01'], policies: [{ policy: { id: 'TL-LEND-PO01' } }] }),
  },
  {
    test: 'LA-MOD-UC20-R04-T01', list: ['LA-MOD-QRY171', { domain_id: 'TL-LEND' }], listed: 'TL-LEND-SP01', read: ['LA-MOD-QRY170', { id: 'TL-LEND-SP01' }],
    holds: (w) => expect(w).toMatchObject({ predicate: { predicate: { id: 'TL-LEND-SP01-PR' } }, test: { test: { id: 'TL-LEND-SP01-T' } } }),
  },
  {
    test: 'LA-MOD-UC21-R02-T01', list: ['LA-MOD-QRY180', { domain_id: 'TL-LEND' }], listed: 'TL-LEND-RM01', read: ['LA-MOD-QRY179', { id: 'TL-LEND-RM01' }],
    holds: (w) => {
      expect(w.fields.map((f: any) => f.name)).toEqual(['Days overdue']);
      expect(w.queries.map((q: any) => q.query.id)).toEqual(['TL-LEND-QRY01']);
    },
  },
  {
    test: 'LA-MOD-UC24-R03-T01', list: ['LA-MOD-QRY175', { product_id: 'TL' }], listed: 'TL-VO01', read: ['LA-MOD-QRY174', { id: 'TL-VO01' }],
    holds: (w) => {
      expect(w.fields.map((f: any) => f.name)).toEqual(['Address']);
      expect(w.constraints.map((c: any) => c.constraint.id)).toEqual(['TL-VO01-C01']);
    },
  },
  {
    test: 'LA-MOD-UC25-R04-T01', list: ['LA-MOD-QRY156', { aggregate_id: 'TL-LEND-A1' }], listed: 'TL-LEND-EV01', read: ['LA-MOD-QRY155', { id: 'TL-LEND-EV01' }],
    holds: (w) => expect(w).toMatchObject({ fields: [{ name: 'Loan ID' }], raisedBy: ['TL-LEND-CMD01'], heardBy: ['TL-LEND-PO01'] }),
  },
  {
    test: 'LA-MOD-UC31-R02-T01', list: ['LA-MOD-QRY221', { parent: 'TL-LEND-A1' }], listed: 'TL-LEND-A1-SR01', read: ['LA-MOD-QRY220', { id: 'TL-LEND-A1-SR01' }],
    holds: (w) => expect(w.tests.map((t: any) => t.test.id)).toEqual(['TL-LEND-A1-SR01-T01']),
  },
  {
    test: 'LA-UCS-UC05-R11-T01', list: ['LA-UCS-QRY139', { product_id: 'TL' }], listed: 'TL-PAT-ACT', read: ['LA-UCS-QRY138', { id: 'TL-PAT-ACT' }],
    holds: (w) => {
      expect(w.settings.map((s: any) => s.name)).toEqual(['record']);
      expect(w.rules.map((r: any) => r.rule.id)).toEqual(['TL-PAT-ACT-R01']);
      expect(JSON.stringify(w)).toContain('TL-PAT-ACT-SL01');
    },
  },
  {
    test: 'LA-UCS-UC06-R83-T01', list: ['LA-UCS-QRY101', { domain_id: 'TL-LEND' }], listed: 'TL-LEND-UC01', read: ['LA-UCS-QRY100', { id: 'TL-LEND-UC01' }],
    holds: (w) => {
      expect(w.requirements[0]).toMatchObject({ requirement: { id: 'TL-LEND-UC01-R01' }, tests: [{ test: { id: 'TL-LEND-UC01-R01-T01' } }] });
      expect(JSON.stringify(w)).toContain('TL-LEND-UC01-FL-S01');
    },
  },
  {
    test: 'LA-IXD-UC18-R07-T01', list: ['LA-IXD-QRY191', { product_id: 'TL' }], listed: 'TL-V01', read: ['LA-IXD-QRY190', { id: 'TL-V01' }],
    holds: (w) => expect(w).toMatchObject({ presents: ['TL-LEND-CMD01'], requirements: [{ requirement: { id: 'TL-V01-R01' }, tests: [{ test: { id: 'TL-V01-R01-T01' } }] }] }),
  },
  {
    test: 'LA-IXD-UC26-R03-T01', list: ['LA-IXD-QRY195', { parent: 'TL-LEND-CMD01' }], listed: 'TL-LEND-EP01', read: ['LA-IXD-QRY194', { id: 'TL-LEND-EP01' }],
    holds: (w) => expect(w).toMatchObject({ handler: { handler: { id: 'TL-LEND-EP01-H' } }, requirements: [{ requirement: { id: 'TL-LEND-EP01-R01' } }] }),
  },
  {
    test: 'LA-IXD-UC27-R03-T01', list: ['LA-IXD-QRY200', { product_id: 'TL' }], listed: 'TL-INT01', read: ['LA-IXD-QRY199', { id: 'TL-INT01' }],
    holds: (w) => expect(w).toMatchObject({ adapter: { adapter: { id: 'TL-INT01-AD' } }, tests: [{ test: { id: 'TL-INT01-T01' } }] }),
  },
  {
    test: 'LA-IXD-UC28-R02-T01', list: ['LA-IXD-QRY205', { product_id: 'TL' }], listed: 'TL-UI01', read: ['LA-IXD-QRY204', { id: 'TL-UI01' }],
    holds: (w) => expect(w).toMatchObject({ renders: ['TL-V01'], builds: ['TL-V01-R01'] }),
  },
  {
    test: 'LA-TEC-UC16-R03-T01', list: ['LA-TEC-QRY143', { product_id: 'TL' }], listed: 'TL-STD-CODE', read: ['LA-TEC-QRY142', { id: 'TL-STD-CODE' }],
    holds: (w) => expect(w.rules[0]).toMatchObject({ rule: { id: 'TL-STD-CODE-R01' }, metBy: ['TL-LEND-CMD01-H'], tests: [{ test: { id: 'TL-STD-CODE-R01-T01' } }] }),
  },
  {
    test: 'LA-TEC-UC17-R11-T01', list: ['LA-TEC-QRY186', { parent: 'TL-LEND-EN01' }], listed: 'TL-LEND-EN01-TB', read: ['LA-TEC-QRY185', { id: 'TL-LEND-EN01-TB' }],
    holds: (w) => expect(w.keys.map((k: any) => k.type)).toEqual(['primary', 'unique']),
  },
  {
    test: 'LA-TEC-UC29-R02-T01', list: ['LA-TEC-QRY121', { domain_id: 'TL-LEND' }], listed: 'TL-LEND-ENTRY01', read: ['LA-TEC-QRY120', { id: 'TL-LEND-ENTRY01' }],
    holds: (w) => expect(w).toMatchObject({ entryPoint: { id: 'TL-LEND-ENTRY01', file: 'src/server.ts' }, packages: [], meets: [] }),
  },
  {
    test: 'LA-TEC-UC30-R02-T01', list: ['LA-TEC-QRY124', { domain_id: 'TL-LEND' }], listed: 'TL-LEND-TOOL01', read: ['LA-TEC-QRY123', { id: 'TL-LEND-TOOL01' }],
    holds: (w) => expect(w).toMatchObject({ tooling: { id: 'TL-LEND-TOOL01', file: 'vitest.config.ts' }, generates: ['TL-LEND-EN01-DM'] }),
  },
  {
    test: 'LA-TEC-UC32-R02-T01', list: ['LA-TEC-QRY226', { parent: 'TL' }], listed: 'TL-STORE01', read: ['LA-TEC-QRY225', { id: 'TL-STORE01' }],
    holds: (w) => expect(w).toMatchObject({ store: { kind: 'database' }, providedBy: { id: 'TL-INT01' }, stores: [{ id: 'TL-LEND-REPO01' }] }),
  },
  {
    test: 'LA-TST-UC13-R10-T01', list: ['LA-TST-QRY136', { domain_id: 'TL-LEND' }], listed: 'TL-LEND-TD01', read: ['LA-TST-QRY135', { id: 'TL-LEND-TD01' }],
    holds: (w) => expect(w.startedFromBy).toEqual(['TL-INT01-T01']),
  },
];

describe('Finding a record and reading it whole before changing it', () => {
  for (const { test, list, listed, read, holds } of READS) {
    it(test, async () => {
      const store = await storeOf();
      if (list) expect(ids(ask(store, ...list)), list[0]).toContain(listed);
      holds(ask(store, ...read));
    });
  }
});

/**
 * The Loan's domain records that link to one another, which only move together, since a link of one domain never
 * reaches into another: the aggregates, the domain service a command calls, the specification it checks and the read
 * model and repository over the Loan.
 */
const LINKED: [string, string][] = [
  ['aggregate move-aggregate', 'TL-LEND-A2'],
  ['domain move-domain-service', 'TL-LEND-DS01'],
  ['domain move-repository', 'TL-LEND-REPO01'],
];

/**
 * Each use case test that moves a record to the catalog domain: the move, the record, its new ID and those under it,
 * and the records it links to that move with it in the same change.
 */
const MOVES: { test: string; move: string; id: string; to: string; under?: string[]; with?: [string, string][] }[] = [
  { test: 'LA-PRD-UC50-R01-T01', move: 'extension-record move-extension-record', id: 'TL-LEND-MOD01', to: 'TL-CAT-MOD01' },
  { test: 'LA-MOD-UC42-R01-T01', move: 'aggregate move-aggregate', id: 'TL-LEND-A1', to: 'TL-CAT-A1', under: ['TL-CAT-EN01', 'TL-CAT-CMD01'], with: [...LINKED, ['specification move-specification', 'TL-LEND-SP01'], ['read-model move-read-model', 'TL-LEND-RM01']] },
  { test: 'LA-MOD-UC47-R01-T01', move: 'specification move-specification', id: 'TL-LEND-SP01', to: 'TL-CAT-SP01', under: ['TL-CAT-SP01-PR'], with: [...LINKED, ['aggregate move-aggregate', 'TL-LEND-A1'], ['read-model move-read-model', 'TL-LEND-RM01']] },
  { test: 'LA-MOD-UC51-R01-T01', move: 'read-model move-read-model', id: 'TL-LEND-RM01', to: 'TL-CAT-RM01', under: ['TL-CAT-QRY01', 'TL-CAT-RM01-PJ', 'TL-CAT-RM01-RD'], with: [...LINKED, ['aggregate move-aggregate', 'TL-LEND-A1'], ['specification move-specification', 'TL-LEND-SP01']] },
  { test: 'LA-TEC-UC38-R01-T01', move: 'entry-point move-entry-point', id: 'TL-LEND-ENTRY01', to: 'TL-CAT-ENTRY01' },
  { test: 'LA-TEC-UC40-R01-T01', move: 'tooling move-tooling', id: 'TL-LEND-TOOL01', to: 'TL-CAT-TOOL01' },
  { test: 'LA-TEC-UC43-R01-T01', move: 'data-store move-data-store', id: 'TL-LEND-STORE02', to: 'TL-CAT-STORE02' },
  { test: 'LA-TST-UC22-R01-T01', move: 'test-data-set move-test-data-set', id: 'TL-LEND-TD01', to: 'TL-CAT-TD01' },
];

describe('Moving a record to another domain', () => {
  for (const { test, move, id, to, under = [], with: linked = [] } of MOVES) {
    it(test, async () => {
      const store = await storeOf();
      await runCommands(store, [[move, id] as [string, string], ...linked].map(([name, record]) => [command(name), { id: record, domain_id: 'TL-CAT' }] as const));
      expect(store.record(id), id).toBeUndefined();
      for (const moved of [to, ...under]) expect(store.record(moved), moved).toBeDefined();
    });
  }

  it('LA-TST-UC22-R01-T01 the tests that start from a moved data set name its new ID', async () => {
    const store = await storeOf();
    await runCommand(store, command('test-data-set move-test-data-set'), { id: 'TL-LEND-TD01', domain_id: 'TL-CAT' });
    expect(store.rows('starts_from')).toContainEqual({ source_id: 'TL-INT01-T01', target_id: 'TL-CAT-TD01' });
  });
});

async function refusal(store: Store, name: string, input: unknown): Promise<StoreError> {
  try {
    await runCommand(store, command(name), input);
  } catch (error) {
    if (error instanceof StoreError) return error;
    throw error;
  }
  throw new Error(`${name} was not refused`);
}

describe('LA-MOD-UC57-R01-T01 a storage requirement and its tests change, a test goes, and the requirement goes with its tests', () => {
  it('changes the statement and the test, removes a second test, then removes the requirement whole', async () => {
    const store = await storeOf();
    await runCommand(store, command('storage-requirement change-storage-requirement'), { id: 'TL-LEND-A1-SR01', statement: 'A loan MUST be saved with its event in one transaction.' });
    await runCommand(store, command('storage-requirement change-storage-requirement-test'), { id: 'TL-LEND-A1-SR01-T01', state: 'manual', manual_reason: 'The outbox cannot be broken on purpose yet.', file: null });
    expect(store.record('TL-LEND-A1-SR01')?.row.statement).toBe('A loan MUST be saved with its event in one transaction.');
    expect(store.record('TL-LEND-A1-SR01-T01')?.row).toMatchObject({ state: 'manual' });
    await runCommand(store, command('storage-requirement add-storage-requirement-test'), { id: 'TL-LEND-A1-SR01-T02', title: 'A crash leaves nothing', storage_requirement_id: 'TL-LEND-A1-SR01', level: 'integration', state: 'not automated yet', when: 'Stops the process mid-save.', then: 'Expects neither saved.' });
    await runCommand(store, command('storage-requirement remove-storage-requirement-test'), { id: 'TL-LEND-A1-SR01-T02' });
    expect(store.record('TL-LEND-A1-SR01-T02')).toBeUndefined();
    await runCommand(store, command('storage-requirement remove-storage-requirement'), { id: 'TL-LEND-A1-SR01' });
    expect(store.record('TL-LEND-A1-SR01')).toBeUndefined();
    expect(store.record('TL-LEND-A1-SR01-T01')).toBeUndefined();
  });
});

describe('LA-TEC-UC41-R01-T01 a data store changes, one a repository is kept in cannot go, and one nothing is kept in goes', () => {
  it('changes the description, refuses removing the database, and removes the cache', async () => {
    const store = await storeOf();
    await runCommand(store, command('data-store change-data-store'), { id: 'TL-STORE01', description: "The library's PostgreSQL database." });
    expect(store.record('TL-STORE01')?.row.description).toBe("The library's PostgreSQL database.");
    expect((await refusal(store, 'data-store remove-data-store', { id: 'TL-STORE01' })).message).toContain('TL-LEND-REPO01');
    await runCommand(store, command('data-store remove-data-store'), { id: 'TL-LEND-STORE02' });
    expect(store.record('TL-LEND-STORE02')).toBeUndefined();
  });
});

describe('LA-TRC-UC07-R08-T01 a pattern\'s followers, a follower\'s patterns and one following\'s values are read', () => {
  it('lists the use case among the followers, its patterns, and the value it gives the record setting', async () => {
    const store = await storeOf();
    expect(ask(store, 'LA-TRC-QRY14', { pattern_id: 'TL-PAT-ACT' })).toMatchObject({ domains: [{ domain: 'TL-LEND', useCases: [{ follower: 'TL-LEND-UC01' }] }] });
    expect(ask(store, 'LA-TRC-QRY11', { follower_id: 'TL-LEND-UC01' })).toEqual(['TL-PAT-ACT']);
    expect(ask(store, 'LA-TRC-QRY10', { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT' })).toMatchObject({ settings: [{ setting: 'record', value: 'Tool' }] });
  });
});

describe('LA-TRC-UC21-R52-T01 a fill recorded by hand is listed as debt at its slot', () => {
  it('records the query handler as a fill, and coverage lists it at the slot', async () => {
    const store = await storeOf();
    await runCommand(store, command('slot-filling fill-slot'), { record_id: 'TL-LEND-QRY01-H', slot_id: 'TL-PAT-ACT-SL01' });
    const root = path.dirname(store.dataDir);
    await store.close();
    open.splice(open.indexOf(store), 1);
    const ws = await loadWorkspace(root);
    expect(ws.coverage.flatMap((c) => c.debt)).toContainEqual({ id: 'TL-LEND-QRY01-H', slot: 'TL-PAT-ACT-SL01' });
  });
});

describe('LA-PLT-UC01-R18-T01 loadWorkspace on data the store refuses returns no records and a data-refused error per refusal', () => {
  it('loads nothing from a command under an entity that does not exist', async () => {
    const broken = data();
    broken.command = broken.command.map((c) => ({ ...c, entity_id: 'TL-LEND-EN09' }));
    const ws = await loadWorkspace(writeData(broken));
    expect(ws.records).toEqual([]);
    expect(ws.problems.length).toBeGreaterThan(0);
    expect(ws.problems.every((p) => p.check === 'data-refused' && p.severity === 'error')).toBe(true);
  });
});
