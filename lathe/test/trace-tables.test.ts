// Tables against the real schema (LA-TRC-UC16): a table kept in a database is checked against the file that creates
// it, read as text, by its name, its columns and its keys; a table stored as a table with no file is a gap.
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, type Row } from '../src/index.ts';
import { expectedColumns, readDefinitions } from '../src/trace/tables.ts';
import { build, changing, gaps, loadData, ofCheck, removeData, type Data } from './helpers.ts';
import { add, LENDING, product, removeProducts } from './flows/product.ts';

afterAll(() => {
  removeData();
  removeProducts();
});

/** An entity field, text unless `more` says otherwise; a column given as undefined is left out. */
const field = (entity_id: string, position: number, name: string, more: Record<string, Row[string] | undefined> = {}): Row =>
  Object.fromEntries(Object.entries({ entity_id, position, name, meaning: `The ${name.toLowerCase()}.`, type: 'text', required: true, ...more }).filter(([, v]) => v !== undefined)) as Row;

/** Members, loans and tools in one domain, each with a table in db/schema.sql, and a view of members in db/views.sql. */
const LIBRARY: Data = {
  product: [{ id: 'PX', title: 'Product X' }],
  domain: [{ id: 'PX-LEND', title: 'Lending', product_id: 'PX', subdomain_type: 'core' }],
  aggregate: [
    { id: 'PX-LEND-A1', title: 'Member', domain_id: 'PX-LEND' },
    { id: 'PX-LEND-A2', title: 'Loan', domain_id: 'PX-LEND' },
    { id: 'PX-LEND-A3', title: 'Tool', domain_id: 'PX-LEND' },
  ],
  entity: [
    { id: 'PX-LEND-EN01', title: 'Member', aggregate_id: 'PX-LEND-A1', role: 'root' },
    { id: 'PX-LEND-EN02', title: 'Loan', aggregate_id: 'PX-LEND-A2', role: 'root' },
    { id: 'PX-LEND-EN03', title: 'Tool', aggregate_id: 'PX-LEND-A3', role: 'root' },
  ],
  entity_field: [
    field('PX-LEND-EN01', 1, 'Member ID', { type: 'whole number', column_name: 'id' }),
    field('PX-LEND-EN01', 2, 'Email'),
    field('PX-LEND-EN01', 3, 'Joined at', { type: 'date and time' }),
    field('PX-LEND-EN02', 1, 'Loan ID', { type: 'whole number', column_name: 'id' }),
    field('PX-LEND-EN02', 2, 'Member', { type: undefined, type_aggregate_id: 'PX-LEND-A1', column_name: 'member_id' }),
    field('PX-LEND-EN02', 3, 'Due date', { type: 'date' }),
    field('PX-LEND-EN03', 1, 'Tool ID', { type: 'whole number', column_name: 'id' }),
  ],
  read_model: [{ id: 'PX-LEND-RM01', title: 'Member list', domain_id: 'PX-LEND' }],
  read_model_field: [
    { read_model_id: 'PX-LEND-RM01', position: 1, name: 'Member ID', meaning: 'The member.', type: 'whole number', required: true, column_name: 'id' },
    { read_model_id: 'PX-LEND-RM01', position: 2, name: 'Name', meaning: 'What the list shows.', type: 'text', required: true },
  ],
  table: [
    { id: 'PX-LEND-EN01-TB', title: 'members', entity_id: 'PX-LEND-EN01', name: 'members', storage: 'table', file: 'db/schema.sql' },
    { id: 'PX-LEND-EN02-TB', title: 'loans', entity_id: 'PX-LEND-EN02', name: 'loans', storage: 'table', file: 'db/schema.sql' },
    { id: 'PX-LEND-EN03-TB', title: 'tools', entity_id: 'PX-LEND-EN03', name: 'tools', storage: 'table', file: 'db/schema.sql' },
    { id: 'PX-LEND-RM01-TB', title: 'member_list', read_model_id: 'PX-LEND-RM01', name: 'member_list', storage: 'view', file: 'db/views.sql' },
  ],
  table_key: [
    { table_id: 'PX-LEND-EN01-TB', position: 1, type: 'primary', columns: ['id'] },
    { table_id: 'PX-LEND-EN01-TB', position: 2, type: 'unique', columns: ['email'] },
    { table_id: 'PX-LEND-EN02-TB', position: 1, type: 'primary', columns: ['id'] },
    { table_id: 'PX-LEND-EN02-TB', position: 2, type: 'foreign', columns: ['member_id'], target_table_id: 'PX-LEND-EN01-TB' },
  ],
};

const SCHEMA = `-- members is whole; loans leaves out its member and its keys; tools is not here.
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE, -- one member per address
  joined_at TEXT NOT NULL
);
CREATE TABLE loans (id INTEGER, due_date TEXT);
`;
const VIEWS = 'CREATE OR REPLACE VIEW member_list AS SELECT m.id, m.email AS name FROM members m;\n';

describe('A table kept in a database is checked against the file that creates it', () => {
  it('LA-TRC-UC16-R01-T01 a file that lacks the table, a column or a key is a warning for each', async () => {
    const ws = await loadData(LIBRARY, { files: { 'db/schema.sql': SCHEMA, 'db/views.sql': VIEWS } });
    const found = ofCheck(ws, 'table-schema-mismatch');
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(found.map((p) => `${p.record}: ${p.message}`)).toEqual([
      'PX-LEND-EN02-TB: Table PX-LEND-EN02-TB names db/schema.sql, which gives loans no column member_id.',
      'PX-LEND-EN02-TB: Table PX-LEND-EN02-TB names db/schema.sql, which gives loans no primary key (id).',
      'PX-LEND-EN02-TB: Table PX-LEND-EN02-TB names db/schema.sql, which gives loans no foreign key (member_id) referencing members.',
      'PX-LEND-EN03-TB: Table PX-LEND-EN03-TB names db/schema.sql, which defines no table or view named tools.',
    ]);

    // Written whole, the file gives no warning; a key on the wrong target table is still one.
    const whole = `${SCHEMA.replace('CREATE TABLE loans (id INTEGER, due_date TEXT);', 'CREATE TABLE loans (id INTEGER PRIMARY KEY, member_id INTEGER REFERENCES members (id), due_date TEXT);')}CREATE TABLE tools (id INTEGER PRIMARY KEY);\n`;
    expect(ofCheck(await loadData(LIBRARY, { files: { 'db/schema.sql': whole, 'db/views.sql': VIEWS } }), 'table-schema-mismatch')).toEqual([]);
    const wrongTarget = whole.replace('REFERENCES members (id)', 'REFERENCES tools (id)');
    expect(ofCheck(await loadData(LIBRARY, { files: { 'db/schema.sql': wrongTarget, 'db/views.sql': VIEWS } }), 'table-schema-mismatch').map((p) => p.message)).toEqual([
      'Table PX-LEND-EN02-TB names db/schema.sql, which gives loans no foreign key (member_id) referencing members.',
    ]);

    // A missing file is technical-file-missing's, not this check's.
    const missing = await loadData(LIBRARY, { missing: ['db/schema.sql'], files: { 'db/views.sql': VIEWS } });
    expect(ofCheck(missing, 'table-schema-mismatch')).toEqual([]);
    expect(ofCheck(missing, 'technical-file-missing').map((p) => p.record).sort()).toEqual(['PX-LEND-EN01-TB', 'PX-LEND-EN02-TB', 'PX-LEND-EN03-TB']);
  });

  it('LA-TRC-UC16-R02-T01 the columns come from column names, field names, flattened value objects and children kept in the root\'s table', async () => {
    const data: Data = {
      ...LIBRARY,
      value_object: [
        { id: 'PX-VO01', title: 'Money' },
        { id: 'PX-VO02', title: 'Email address' },
      ],
      value_object_field: [
        { value_object_id: 'PX-VO01', position: 1, name: 'Amount', meaning: 'How much.', type: 'decimal', required: true },
        { value_object_id: 'PX-VO01', position: 2, name: 'Currency code', meaning: 'Which money.', type: 'text', required: true, column_name: 'currency' },
        { value_object_id: 'PX-VO02', position: 1, name: 'Address', meaning: 'The address.', type: 'text', required: true },
      ],
      entity: [...LIBRARY.entity, { id: 'PX-LEND-EN04', title: 'Return', aggregate_id: 'PX-LEND-A2', role: 'child', in_root_table: true }],
      entity_field: [
        ...LIBRARY.entity_field.filter((f) => f.entity_id !== 'PX-LEND-EN02' || f.position !== 3),
        field('PX-LEND-EN02', 3, 'Late fee', { type: undefined, type_value_object_id: 'PX-VO01' }),
        field('PX-LEND-EN02', 4, 'Contact e-mail', { type: undefined, type_value_object_id: 'PX-VO02' }),
        field('PX-LEND-EN04', 1, 'Returned at', { type: 'date and time' }),
        field('PX-LEND-EN04', 2, 'Note', { column_name: 'Return_Note' }),
      ],
    };
    const store = await openStore(await build(data), { latheDataDir: null });
    try {
      const loans = store.rows('table').find((t) => t.id === 'PX-LEND-EN02-TB')!;
      expect(expectedColumns(store, loans)).toEqual(['id', 'member_id', 'amount', 'currency', 'contact_e_mail', 'returned_at', 'return_note']);
      expect(expectedColumns(store, store.rows('table').find((t) => t.id === 'PX-LEND-RM01-TB')!)).toEqual(['id', 'name']);
    } finally {
      await store.close();
    }

    // What the recognizer reads: inline and table keys, CONSTRAINT names, indexes, ALTER TABLE, quoted and qualified
    // names, comments, and the names a SELECT list gives with AS, through a WITH clause and a code template's
    // interpolations.
    const text = `
      CREATE TABLE "Main"."Loans" (
        "ID" INTEGER,
        member_id INTEGER, /* who */
        [due date] TEXT,
        CONSTRAINT loans_pk PRIMARY KEY (ID),
        FOREIGN KEY (member_id) REFERENCES main.members (id),
        CHECK (member_id > 0)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS loans_one ON loans (member_id, lower(due_date)) WHERE x IS NULL;
      CREATE INDEX loans_due ON loans (\`due date\` DESC);
      ALTER TABLE loans ADD CONSTRAINT loans_member UNIQUE (member_id);
      const sql = \`CREATE OR REPLACE TABLE late AS
        WITH open AS (SELECT l.id, \${pick('x;y')} AS fee, count(*) FROM loans l)
        SELECT * FROM open;\`;
      CREATE MATERIALIZED VIEW counts AS SELECT DISTINCT member_id, count(*) AS total, t.* FROM loans t;
    `;
    const defs = readDefinitions(text);
    expect([...defs.keys()].sort()).toEqual(['counts', 'late', 'loans']);
    const loans = defs.get('loans')!;
    expect([...loans.columns]).toEqual(['id', 'member_id', 'due date']);
    expect(loans.keys).toEqual([
      { type: 'primary', columns: ['id'] },
      { type: 'foreign', columns: ['member_id'], target: 'members' },
      { type: 'unique', columns: ['member_id'] },
      { type: 'index', columns: ['due date'] },
      { type: 'unique', columns: ['member_id'] },
    ]);
    expect([...defs.get('late')!.columns]).toEqual(['id', 'fee']);
    expect(defs.get('late')!.bodies).toEqual([]);
    // A star from a table cannot say what it brings, so the body is kept to find a column's name in.
    expect([...defs.get('counts')!.columns]).toEqual(['member_id', 'total']);
    expect(defs.get('counts')!.bodies).toHaveLength(1);
  });

  it('LA-TRC-UC16-R03-T01 a table stored as a table with no file is a gap; one in browser storage is not', async () => {
    const data = changing(
      { ...LIBRARY, table: [...LIBRARY.table.filter((t) => t.id !== 'PX-LEND-RM01-TB'), { id: 'PX-LEND-RM01-TB', title: 'member list', read_model_id: 'PX-LEND-RM01', name: 'memberList', storage: 'browser storage' }] },
      'table',
      (t) => t.id === 'PX-LEND-EN03-TB',
      { file: undefined },
    );
    const all = gaps(await loadData(data, { files: { 'db/schema.sql': SCHEMA } }));
    expect(all.filter((g) => g.startsWith('table-without-file '))).toEqual(['table-without-file PX-LEND-EN03-TB']);
  });
});

describe('Check a table against its file from the command line', () => {
  it('LA-TRC-UC16-FL03-T names a table\'s migration, checks it, and fixes the missing column', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('entity_field', { entity_id: 'TL-LEND-EN01', position: 2, name: 'Due date', meaning: 'The last day.', type: 'date', required: true }),
    ]);
    tl.write('db/001-loans.sql', 'CREATE TABLE loans (id INTEGER PRIMARY KEY);\n');
    // S01: the Agent names the table's migration.
    tl.run('add', 'table', '--id', 'TL-LEND-EN01-TB', '--title', 'loans', '--entity_id', 'TL-LEND-EN01', '--name', 'loans', '--storage', 'table', '--file', 'db/001-loans.sql');
    // S02 and S03: lathe check reads it, and warns of the column it leaves out, naming the table and the file.
    const first = tl.check();
    expect(first.stdout).toContain('[table-schema-mismatch] TL-LEND-EN01-TB: Table TL-LEND-EN01-TB names db/001-loans.sql, which gives loans no column due_date.');
    // The Agent fixes the file, and the next check is clean.
    tl.write('db/001-loans.sql', 'CREATE TABLE loans (id INTEGER PRIMARY KEY, due_date DATE NOT NULL);\n');
    expect(tl.check().stdout).not.toContain('table-schema-mismatch');
  });
});
