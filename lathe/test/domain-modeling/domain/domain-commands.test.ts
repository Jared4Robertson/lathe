// The Domain aggregate's commands, queries and refusals (LA-MOD-A4), run on a store as the CLI, the MCP tools and the
// HTTP API run them: each command changes one domain through DomainRepository, holds it to its rules before it saves,
// and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_DOMAIN } from '../../../src/domain-modeling/domain/commands/add-domain.ts';
import { ADD_REPOSITORY } from '../../../src/domain-modeling/domain/commands/add-repository.ts';
import { ADD_TERM } from '../../../src/domain-modeling/domain/commands/add-term.ts';
import { CHANGE_CAPABILITY } from '../../../src/domain-modeling/domain/commands/change-capability.ts';
import { CHANGE_DOMAIN } from '../../../src/domain-modeling/domain/commands/change-domain.ts';
import { CHANGE_REPOSITORY } from '../../../src/domain-modeling/domain/commands/change-repository.ts';
import { CHANGE_SERVICE } from '../../../src/domain-modeling/domain/commands/change-service.ts';
import { CHANGE_TERM } from '../../../src/domain-modeling/domain/commands/change-term.ts';
import { REMOVE_CAPABILITY } from '../../../src/domain-modeling/domain/commands/remove-capability.ts';
import { REMOVE_DOMAIN } from '../../../src/domain-modeling/domain/commands/remove-domain.ts';
import { REMOVE_DOMAIN_SERVICE } from '../../../src/domain-modeling/domain/commands/remove-domain-service.ts';
import { GET_DOMAIN, LIST_DOMAINS, NEXT_DOMAIN_ID } from '../../../src/domain-modeling/domain/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { everyKind } from '../../store/fixture.ts';
import { refusals, withTable, writeData } from '../../helpers.ts';
import { lendingDomain } from './data-set.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/** A store on the data set, or on every kind's data when a test needs another aggregate's records. */
async function storeOf(data?: ReturnType<typeof everyKind>): Promise<Store> {
  const store = data ? await openStore(writeData(data), { latheDataDir: null }) : await lendingDomain();
  open.push(store);
  return store;
}

/** The refusal a command gets, or a failure when it is not refused. */
async function refusal(store: Store, definition: AnyCommand, input: unknown): Promise<StoreError> {
  try {
    await runCommand(store, definition, input);
  } catch (error) {
    if (error instanceof StoreError) return error;
    throw error;
  }
  throw new Error(`${definition.name} was not refused`);
}

const fileOf = (store: Store, table: string) => readFileSync(path.join(store.dataDir, `${table}.jsonl`), 'utf8');

describe('LA-MOD-UC34-R01-T02 each Domain command (LA-MOD-A4) changes one domain through DomainRepository, held to its rules', () => {
  it('builds a domain with its own commands, and reads it whole by any record in it', async () => {
    const store = await storeOf();
    const whole = runQuery(store, GET_DOMAIN, { id: 'TL-LEND-DS01-T01' }) as ReturnType<typeof GET_DOMAIN.run>;
    expect(whole.record).toEqual({ id: 'TL-LEND-DS01-T01', kind: 'domain_service_test' });
    expect(whole.domain.id).toBe('TL-LEND');
    expect(whole.capabilities.map((c) => c.capability.id)).toEqual(['TL-LEND-CAP01']);
    expect(whole.domainServices.map((s) => s.service)).toEqual([{ service: { id: 'TL-LEND-DS01-SV', title: 'lateFee', domain_service_id: 'TL-LEND-DS01', file: 'src/fees.ts' }, meets: [], packages: [], helpers: [] }]);
    expect(whole.domainServices[0].tests.map((t) => t.test.id)).toEqual(['TL-LEND-DS01-T01']);
    expect(whole.repositories).toEqual([expect.objectContaining({ persists: null, meets: [], packages: [], helpers: [] })]);
    expect(whole.repositories[0]).not.toHaveProperty('alsoPersists');
    expect(runQuery(store, LIST_DOMAINS, { product_id: 'TL' })).toEqual([{ id: 'TL-LEND', title: 'Lending' }]);
    expect(runQuery(store, NEXT_DOMAIN_ID, { kind: 'capability', parent: 'TL-LEND' })).toBe('TL-LEND-CAP02');
    expect(runQuery(store, NEXT_DOMAIN_ID, { kind: 'domain_service_test', parent: 'TL-LEND-DS01' })).toBe('TL-LEND-DS01-T02');
    expect(() => runQuery(store, NEXT_DOMAIN_ID, { kind: 'service', parent: 'TL-LEND-DS01' })).toThrow(/already has its service, TL-LEND-DS01-SV/);
    expect(() => runQuery(store, NEXT_DOMAIN_ID, { kind: 'domain', parent: 'TL' })).toThrow(/has no next ID/);
  });

  it('changes a domain and a capability\'s links, writing only its own tables; null clears an optional column', async () => {
    const store = await storeOf(everyKind());
    expect((await runCommand(store, CHANGE_CAPABILITY, { id: 'TL-LEND-CAP01', serves: [] })).tables).toEqual(['serves']);
    await runCommand(store, CHANGE_DOMAIN, { id: 'TL-LEND', notes: 'Fines are kept low.' });
    expect((await runCommand(store, CHANGE_DOMAIN, { id: 'TL-LEND', notes: null })).tables).toEqual(['domain']);
    expect(store.record('TL-LEND')?.row).not.toHaveProperty('notes');
    const changed = await runCommand(store, CHANGE_SERVICE, { id: 'TL-LEND-DS01-SV', meets: ['TL-STD-CODE-R01'], packages: ['date-fns'] });
    expect(changed.tables).toEqual(['meets', 'package_use']);
  });

  it('refuses a repository for an aggregate another repository persists (one-repository), and changes no file', async () => {
    // TL-LEND-REPO01 persists TL-LEND-A1; TL-LEND-A2 has no repository yet.
    const store = await storeOf(everyKind());
    const before = fileOf(store, 'persists');
    const second = { id: 'TL-LEND-REPO02', title: 'ToolRepository', domain_id: 'TL-LEND', file: 'src/lending/tools.ts', description: 'Keeps tools.', persists: 'TL-LEND-A1' };
    expect((await refusal(store, ADD_REPOSITORY, second)).problems).toEqual([
      expect.objectContaining({ rule: 'one-repository', message: 'TL-LEND-REPO01 and TL-LEND-REPO02 both persist TL-LEND-A1: an aggregate has one repository' }),
    ]);
    expect(fileOf(store, 'persists')).toBe(before);
    await runCommand(store, ADD_REPOSITORY, { ...second, persists: 'TL-LEND-A2' });
    expect((await refusal(store, CHANGE_REPOSITORY, { id: 'TL-LEND-REPO01', persists: 'TL-LEND-A2' })).problems).toEqual([
      expect.objectContaining({ rule: 'one-repository', message: 'TL-LEND-REPO01 and TL-LEND-REPO02 both persist TL-LEND-A2: an aggregate has one repository' }),
    ]);
  });

  it('removes a domain service with its service and tests, and refuses a record while another aggregate references it', async () => {
    const own = await storeOf();
    const removed = await runCommand(own, REMOVE_DOMAIN_SERVICE, { id: 'TL-LEND-DS01' });
    expect(removed.changes.filter((c) => c.after === null).map((c) => `${c.table} ${c.key}`).sort()).toEqual(['domain_service TL-LEND-DS01', 'domain_service_test TL-LEND-DS01-T01', 'service TL-LEND-DS01-SV']);
    await runCommand(own, REMOVE_DOMAIN, { id: 'TL-LEND' });
    expect(own.rows('domain')).toEqual([]);
    const store = await storeOf(everyKind());
    expect((await refusal(store, REMOVE_CAPABILITY, { id: 'TL-LEND-CAP01' })).problems[0].message).toMatch(/^Capability TL-LEND-CAP01 is referenced, so it stays: .*TL-LEND-UC01/);
    expect((await refusal(store, REMOVE_DOMAIN, { id: 'TL-LEND' })).problems[0].rule).toBe('referenced');
  });

  it('refuses an input that is not the command\'s', async () => {
    const store = await storeOf();
    await expect(runCommand(store, CHANGE_DOMAIN, { id: 'TL-LEND', product_id: 'TL' })).rejects.toThrow(/change-domain takes no product_id/);
    await expect(runCommand(store, CHANGE_DOMAIN, { id: 'TL-LEND', subdomain_type: 'central' })).rejects.toThrow(InputError);
    expect((await refusal(store, CHANGE_DOMAIN, { id: 'TL-SHOP', title: 'Shop' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no domain TL-SHOP' });
  });

  it('runs `lathe domain <command>`, the domain_ tools and POST /api/domain/<command> by name', async () => {
    const root = writeData(everyKind());
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t), stdin: async () => '' };
    expect(await runAggregateCommand(['domain', 'add-term', '--id', 'TL-LEND-TM03', '--title', 'Member', '--domain_id', 'TL-LEND', '--meaning', 'Someone who borrows tools.', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added term TL-LEND-TM03');
    expect((await callTool(root, 'domain_change_term', { id: 'TL-LEND-TM03', group_name: 'People' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      expect((await post('/api/domain/remove-term', { id: 'TL-LEND-TM03' })).status).toBe(200);
      expect((await post('/api/domain/remove-capability', { id: 'TL-LEND-CAP01' })).status).toBe(422);
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

/** The lending domain with a second domain, Catalog, beside it, and terms added with the Domain commands. */
async function withTerms(terms: { id: string; title: string; builds_on?: string[] }[]): Promise<Store> {
  const store = await storeOf();
  await runCommand(store, ADD_DOMAIN, { id: 'TL-CAT', title: 'Catalog', product_id: 'TL', position: 2, subdomain_type: 'supporting', description: 'The tools the library has.' });
  for (const term of terms) await runCommand(store, ADD_TERM, { domain_id: term.id.startsWith('TL-CAT') ? 'TL-CAT' : 'TL-LEND', meaning: `What ${term.title} means.`, ...term });
  return store;
}

describe('LA-MOD-INV60-T a term never builds on itself: a loop of builds_on links is refused, naming it', () => {
  it('refuses Change term closing a loop, inside a domain and through another, naming it by title from its lowest ID, and changes no file', async () => {
    const store = await withTerms([
      { id: 'TL-LEND-TM02', title: 'Entity' },
      { id: 'TL-LEND-TM03', title: 'Aggregate', builds_on: ['TL-LEND-TM02'] },
      { id: 'TL-CAT-TM01', title: 'Tool', builds_on: ['TL-LEND-TM03'] },
    ]);
    const before = fileOf(store, 'builds_on');
    expect((await refusal(store, CHANGE_TERM, { id: 'TL-LEND-TM02', builds_on: ['TL-LEND-TM03'] })).problems).toEqual([
      expect.objectContaining({ rule: 'term-builds-on-itself', message: 'TL-LEND-TM02 builds on itself: Entity → Aggregate → Entity; define the lower term in plain words, without the term it leads back to' }),
    ]);
    expect((await refusal(store, CHANGE_TERM, { id: 'TL-LEND-TM02', builds_on: ['TL-CAT-TM01'] })).problems).toEqual([
      expect.objectContaining({ rule: 'term-builds-on-itself', message: expect.stringMatching(/^TL-CAT-TM01 builds on itself: Tool → Aggregate → Entity → Tool;/) }),
    ]);
    expect(fileOf(store, 'builds_on')).toBe(before);
    // A link down the chain is no loop.
    expect((await runCommand(store, CHANGE_TERM, { id: 'TL-LEND-TM02', builds_on: ['TL-LEND-TM01'] })).tables).toEqual(['builds_on']);
  });

  it('refuses Add term building on itself', async () => {
    const store = await storeOf();
    const problems = (await refusal(store, ADD_TERM, { id: 'TL-LEND-TM02', title: 'Member', domain_id: 'TL-LEND', meaning: 'A member.', builds_on: ['TL-LEND-TM02'] })).problems;
    expect(problems.map((p) => p.rule)).toContain('term-builds-on-itself');
    expect(problems.find((p) => p.rule === 'term-builds-on-itself')?.message).toMatch(/^TL-LEND-TM02 builds on itself: Member → Member;/);
  });

  it('refuses data holding a loop on load, naming it once', async () => {
    // The fixture's Overdue loan builds on Loan; Loan building on Overdue loan closes the loop.
    const data = withTable(everyKind(), 'builds_on', [{ source_id: 'TL-LEND-TM01', target_id: 'TL-LEND-TM02' }, { source_id: 'TL-LEND-TM02', target_id: 'TL-LEND-TM01' }]);
    expect(await refusals(data)).toEqual([expect.objectContaining({ rule: 'term-builds-on-itself', message: expect.stringMatching(/^TL-LEND-TM01 builds on itself: Loan → Overdue loan → Loan;/) })]);
  });
});

describe('LA-STD-MODELING-R12-T02 a domain\'s glossary lists each term after every term it builds on, otherwise by title', () => {
  it('reads the terms bottom-up, through a term of another domain, each with the terms it builds on', async () => {
    const store = await withTerms([
      { id: 'TL-LEND-TM02', title: 'Zebra' },
      { id: 'TL-LEND-TM03', title: 'Apple', builds_on: ['TL-LEND-TM02'] },
      { id: 'TL-LEND-TM04', title: 'Yak' },
      { id: 'TL-CAT-TM01', title: 'Banana', builds_on: ['TL-LEND-TM04'] },
      { id: 'TL-LEND-TM05', title: 'Cherry', builds_on: ['TL-CAT-TM01'] },
    ]);
    const { terms } = runQuery(store, GET_DOMAIN, { id: 'TL-LEND' }) as ReturnType<typeof GET_DOMAIN.run>;
    expect(terms.map((t) => t.term.title)).toEqual(['Loan', 'Yak', 'Cherry', 'Zebra', 'Apple']);
    expect(terms.find((t) => t.term.title === 'Cherry')?.buildsOn).toEqual(['TL-CAT-TM01']);
  });
});
