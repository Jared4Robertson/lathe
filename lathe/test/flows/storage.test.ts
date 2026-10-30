// The flows of storage: naming where a product's data lives (data stores, and the one each repository, reader and
// table is stored in) and what the business needs kept of each aggregate and read model (storage requirements and
// their storage requirement tests), each walked through the real `lathe` command (LA-IF03) and a real `lathe mcp` server (LA-IF04)
// on a temporary product. Each step runs the aggregate's own command, as the Owner or an Agent would.
import { afterAll, describe, expect, it } from 'vitest';
import type { Command } from '../../src/index.ts';
import { add, flags, gapsOf, LENDING, link, mcp, product, removeProducts } from './product.ts';

afterAll(removeProducts);

/** The lending domain with the Loan aggregate's repository and table, neither stored anywhere yet. */
const STORED: Command[] = [
  ...LENDING,
  add('repository', { id: 'TL-LEND-REPO01', title: 'LoanRepository', domain_id: 'TL-LEND', file: 'src/loans.ts', description: 'Saves a loan with its outbox event in one transaction.' }),
  link('TL-LEND-REPO01', 'persists', 'TL-LEND-A1'),
  add('table', { id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loans', storage: 'table', file: 'src/schema.sql' }),
];

/** A data store under the product, the library's database. */
const DATABASE = { id: 'TL-STORE01', title: 'DATABASE_URL', product_id: 'TL', kind: 'database', description: "The library's PostgreSQL database." };
/** A storage requirement of the Loan aggregate. */
const KEPT = { id: 'TL-LEND-A1-SR01', title: 'A loan is saved with its outbox event', aggregate_id: 'TL-LEND-A1', statement: 'A loan MUST be saved with its outbox event, or neither.' };
/** Its storage requirement test. */
const KEPT_TEST = { id: 'TL-LEND-A1-SR01-T01', title: 'A failed save leaves nothing behind', storage_requirement_id: 'TL-LEND-A1-SR01', level: 'integration', state: 'automated', file: 'test/loans.test.ts', when: 'Opens a loan whose event cannot be written.', then: 'Expects neither saved.' };

describe('Storage flows through the CLI', () => {
  it('LA-AUT-UC32-FL03-T name where a product\'s data lives', async () => {
    const tl = product();
    await tl.seed(STORED);
    const missing = gapsOf(tl.workspace(), 'TL-LEND');
    expect(missing).toContain('stored-nowhere TL-LEND-REPO01');
    expect(missing).toContain('stored-nowhere TL-LEND-EN01-TB');
    // S01: the data store under the product; one under both the product and a domain is refused.
    expect(tl.run('data-store', 'next-id', '--kind', 'data_store', '--parent', 'TL')).toBe('TL-STORE01');
    tl.refused('data-store', 'add-data-store', ...flags({ ...DATABASE, domain_id: 'TL-LEND' }));
    tl.run('data-store', 'add-data-store', ...flags(DATABASE));
    expect(gapsOf(tl.workspace(), null)).toContain('data-store-unused TL-STORE01');
    // S02: the repository and the table each name it, through their own aggregates' commands.
    tl.run('domain', 'change-repository', '--id', 'TL-LEND-REPO01', '--stored_in', 'TL-STORE01');
    tl.run('table', 'change-table', '--id', 'TL-LEND-EN01-TB', '--stored_in', 'TL-STORE01');
    const named = tl.workspace();
    expect([...gapsOf(named, 'TL-LEND'), ...gapsOf(named, null)].filter((g) => /stored-nowhere|data-store-unused/.test(g))).toEqual([]);
    expect(tl.run('data-store', 'get-data-store', '--id', 'TL-STORE01')).toContain('Stores repository TL-LEND-REPO01: LoanRepository');
    // S03: a store with something stored in it stays.
    expect(tl.refused('data-store', 'remove-data-store', '--id', 'TL-STORE01')).toContain('TL-LEND-REPO01 stored in TL-STORE01');
  });

  it('LA-AUT-UC31-FL03-T write what the business needs kept of an aggregate', async () => {
    const tl = product();
    await tl.seed([...STORED, add('data_store', DATABASE)]);
    // S01: the requirement under its aggregate; designed by construction, not built while its repository names no store.
    expect(tl.run('storage-requirement', 'next-id', '--kind', 'storage_requirement', '--parent', 'TL-LEND-A1')).toBe('TL-LEND-A1-SR01');
    tl.run('storage-requirement', 'add-storage-requirement', ...flags(KEPT));
    tl.write('src/loans.ts', 'export class LoanRepository {}\n');
    expect(gapsOf(tl.workspace(), 'TL-LEND')).toEqual(expect.arrayContaining(['built TL-LEND-A1-SR01', 'proved TL-LEND-A1-SR01']));
    tl.run('domain', 'change-repository', '--id', 'TL-LEND-REPO01', '--stored_in', 'TL-STORE01');
    expect(gapsOf(tl.workspace(), 'TL-LEND')).not.toContain('built TL-LEND-A1-SR01');
    // S02: its storage requirement test proves it once its file names it.
    tl.run('storage-requirement', 'add-storage-requirement-test', ...flags(KEPT_TEST));
    tl.write('test/loans.test.ts', "it('TL-LEND-A1-SR01-T01 a failed save leaves nothing behind');\n");
    expect(gapsOf(tl.workspace(), 'TL-LEND').filter((g) => g.endsWith('TL-LEND-A1-SR01'))).toEqual([]);
    expect(tl.run('storage-requirement', 'get-storage-requirement', '--id', 'TL-LEND-A1-SR01')).toContain('built by: TL-LEND-REPO01 LoanRepository (src/loans.ts), stored in TL-STORE01 DATABASE_URL');
  });
});

describe('Storage flows through the MCP tools', () => {
  it('LA-AUT-UC32-FL04-T name where a product\'s data lives through the MCP tools', async () => {
    const tl = product();
    await tl.seed(STORED);
    const server = mcp(tl.root);
    await server.initialize();
    const ok = async (name: string, args: object) => {
      const result = (await server.call(name, args)).result!;
      expect(result.isError, result.content[0].text).toBeUndefined();
      return result.content[0].text;
    };
    try {
      // S01: the data store; S02: the repository and table name it; S03: it stays while they do.
      await ok('data_store_add_data_store', DATABASE);
      await ok('domain_change_repository', { id: 'TL-LEND-REPO01', stored_in: 'TL-STORE01' });
      await ok('table_change_table', { id: 'TL-LEND-EN01-TB', stored_in: 'TL-STORE01' });
      expect(await ok('data_store_get_data_store', { id: 'TL-STORE01' })).toContain('Stores table TL-LEND-EN01-TB: Loans');
      expect((await server.call('data_store_remove_data_store', { id: 'TL-STORE01' })).result!.isError).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('LA-AUT-UC31-FL04-T write what the business needs kept of an aggregate through the MCP tools', async () => {
    const tl = product();
    await tl.seed([...STORED, add('data_store', DATABASE), link('TL-LEND-REPO01', 'stored_in', 'TL-STORE01')]);
    const server = mcp(tl.root);
    await server.initialize();
    const ok = async (name: string, args: object) => {
      const result = (await server.call(name, args)).result!;
      expect(result.isError, result.content[0].text).toBeUndefined();
      return result.content[0].text;
    };
    try {
      // S01: the requirement under its aggregate; S02: its storage requirement test.
      await ok('storage_requirement_add_storage_requirement', KEPT);
      await ok('storage_requirement_add_storage_requirement_test', KEPT_TEST);
      expect(await ok('storage_requirement_get_storage_requirement', { id: 'TL-LEND-A1-SR01-T01' })).toContain('Storage requirement test TL-LEND-A1-SR01-T01: A failed save leaves nothing behind (integration, automated)');
    } finally {
      await server.close();
    }
  });
});
