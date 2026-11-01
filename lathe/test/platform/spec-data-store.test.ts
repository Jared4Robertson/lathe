// The spec data store (LA-PLT-STORE01, the product's data folder) keeps each aggregate stored in it as its storage
// requirement says: a change through the aggregate's own command survives a restart (the store closed and opened
// again on the same files), and a refused one changes no file. Each row runs one aggregate's command on a copy of the
// Tool Library's data, through the command layer as the CLI, the MCP tools and the app run it.
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ALL_COMMANDS } from '../../src/commands.ts';
import { runCommand } from '../../src/platform/commands/run.ts';
import { StoreError } from '../../src/platform/data/problems.ts';
import { openStore } from '../../src/platform/data/store.ts';
import { PACKAGE_DIR } from '../../src/index.ts';

const TOOL_LIBRARY = path.join(PACKAGE_DIR, '..', 'examples', 'tool-library');
const roots: string[] = [];
afterAll(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A copy of the Tool Library's data and config in a fresh folder: the files a test changes. */
function copy(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-spec-store-'));
  roots.push(root);
  cpSync(path.join(TOOL_LIBRARY, 'data'), path.join(root, 'data'), { recursive: true });
  cpSync(path.join(TOOL_LIBRARY, 'lathe.config.json'), path.join(root, 'lathe.config.json'));
  return root;
}

/** Every data file's text, by name. */
const files = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).sort().map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));

/**
 * One aggregate stored in the data folder: its storage requirement test, the command of its own that writes it, an
 * input it accepts, one it refuses, and where the change shows once the store opens again.
 */
interface Kept {
  slice: string;
  command: string;
  input: Record<string, unknown>;
  refused: Record<string, unknown>;
  table: string;
  key: Record<string, unknown>;
  column: string;
}

const change = (slice: string, kind: string, id: string, column = 'title', value = 'Kept through a restart'): Kept => ({
  slice, command: `change-${kind.replaceAll('_', '-')}`, input: { id, [column]: value }, refused: { id: `${id}-NOPE`, [column]: value }, table: kind, key: { id }, column,
});
const add = (slice: string, kind: string, row: Record<string, unknown>, column = 'title'): Kept => ({
  slice, command: `add-${kind.replaceAll('_', '-')}`, input: row, refused: row, table: kind, key: { id: row.id }, column,
});


/** The value the accepted input gives the column, wherever the command takes it. */
const given = (kept: Kept): unknown => {
  const values = kept.input.values as Record<string, unknown> | undefined;
  if (values) return values[kept.column];
  if (kept.table === 'setting_value') return (kept.input.setting_values as { setting: string; value: string }[]).find((v) => v.setting === kept.key.setting)!.value;
  return kept.input[kept.column];
};

describe('the spec data store keeps every change through a restart, and a refused one changes no file', () => {
  it.each<[string, Kept]>([
  ['LA-AUT-A1-SR01-T01', change('product', 'product', 'TL')],
  ['LA-AUT-A2-SR01-T01', change('pattern', 'pattern', 'TL-PAT-LIBRARIAN-ACTION')],
  ['LA-AUT-A3-SR01-T01', add('standard', 'standard', { id: 'TL-STD-KEPT', title: 'Kept', product_id: 'TL', description: 'A standard kept through a restart.' })],
  ['LA-AUT-A4-SR01-T01', change('domain', 'domain', 'TL-LEND')],
  ['LA-AUT-A5-SR01-T01', change('specification', 'specification', 'TL-LEND-SP01')],
  ['LA-AUT-A6-SR01-T01', change('aggregate', 'aggregate', 'TL-LEND-A1')],
  ['LA-AUT-A7-SR01-T01', change('domain-event', 'domain_event', 'TL-LEND-EV01', 'title', 'Member kept')],
  ['LA-AUT-A8-SR01-T01', change('command', 'command', 'TL-LEND-CMD01')],
  ['LA-AUT-A9-SR01-T01', change('value-object', 'value_object', 'TL-VO01')],
  ['LA-AUT-A10-SR01-T01', change('read-model', 'read_model', 'TL-LEND-RM01')],
  ['LA-AUT-A11-SR01-T01', change('use-case', 'use_case', 'TL-LEND-UC01')],
  ['LA-AUT-A12-SR01-T01', add('view', 'view', { id: 'TL-V90', title: 'Kept', description: 'A view kept through a restart.' })],
  ['LA-AUT-A13-SR01-T01', change('endpoint', 'endpoint', 'TL-LEND-EP01', 'description')],
  ['LA-AUT-A14-SR01-T01', add('integration', 'integration', { id: 'TL-INT90', title: 'Kept', description: 'An integration kept through a restart.' })],
  ['LA-AUT-A15-SR01-T01', add('ui-component', 'ui_component', { id: 'TL-UI90', title: 'KeptPage', description: 'A component kept through a restart.' })],
  ['LA-AUT-A16-SR01-T01', change('business-outcome', 'business_outcome', 'TL-BO01')],
  ['LA-AUT-A17-SR01-T01', change('test-data-set', 'test_data_set', 'TL-LEND-TD01')],
  ['LA-AUT-A18-SR01-T01', change('table', 'table', 'TL-LEND-EN01-TB', 'name', 'members_kept')],
  ['LA-AUT-A19-SR01-T01', { ...change('extension-record', 'report', 'TL-LEND-RP01'), command: 'change-extension-record', input: { id: 'TL-LEND-RP01', values: { title: 'keptReport' } }, refused: { id: 'TL-LEND-RP01-NOPE', values: { title: 'keptReport' } }, column: 'title' }],
  ['LA-AUT-A20-SR01-T01', change('entry-point', 'entry_point', 'TL-LEND-ENTRY01', 'description')],
  ['LA-AUT-A21-SR01-T01', change('tooling', 'tooling', 'TL-LEND-TOOL01', 'file', 'tsconfig.kept.json')],
  ['LA-AUT-A22-SR01-T01', change('storage-requirement', 'storage_requirement', 'TL-LEND-A3-SR01')],
  ['LA-AUT-A23-SR01-T01', change('data-store', 'data_store', 'TL-LEND-STORE01', 'description')],
  ['LA-CHK-A1-SR01-T01', {
    slice: 'check', command: 'add-check', table: 'check', key: { name: 'kept-check' }, column: 'summary',
    input: { name: 'kept-check', product_id: 'TL', domain_id: 'LA-CHK', position: 1, severity: 'warning', summary: 'Kept through a restart.', explanation: 'A check kept through a restart.', query: "SELECT NULL AS record, 'kept' AS message WHERE false" },
    refused: { name: 'kept-check', product_id: 'TL', domain_id: 'LA-CHK', position: 1, severity: 'warning', summary: 'Kept through a restart.', explanation: 'A check kept through a restart.', query: "SELECT NULL AS record, 'kept' AS message WHERE false" },
  }],
  ['LA-CHK-A2-SR01-T01', { slice: 'product-setting', command: 'set-limits', table: 'product_setting', key: { product_id: 'TL' }, column: 'max_children', input: { product_id: 'TL', max_children: 21, max_entities_per_aggregate: 8 }, refused: { product_id: 'TL-NOPE', max_children: 21, max_entities_per_aggregate: 8 } }],
  ['LA-TRC-A3-SR01-T01', {
    slice: 'pattern-following', command: 'change-setting-values', table: 'setting_value', key: { follower_id: 'TL-LEND-UC01', setting: 'record' }, column: 'value',
    input: { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-LIBRARIAN-ACTION', setting_values: [{ setting: 'record', value: 'Kept through a restart' }, { setting: 'required_input', value: "The member's name and a valid email address." }, { setting: 'result', value: 'The new member with their ID, which goes on their card.' }] },
    refused: { follower_id: 'TL-LEND-UC09', pattern_id: 'TL-PAT-LIBRARIAN-ACTION', setting_values: [{ setting: 'record', value: 'Kept through a restart' }] },
  }],
])('%s a change through the aggregate\'s own command survives a restart, and a refused one changes no file', async (_id, kept) => {
    const root = copy();
    const definition = ALL_COMMANDS.find((d) => d.slice.name === kept.slice && d.name === kept.command)!;
    expect(definition, `${kept.slice} ${kept.command}`).toBeDefined();
    const store = await openStore(root, { latheDataDir: null });
    try {
      await runCommand(store, definition, kept.input);
      const before = files(root);
      await expect(runCommand(store, definition, kept.refused)).rejects.toBeInstanceOf(StoreError);
      expect(files(root)).toEqual(before);
    } finally {
      await store.close();
    }
    const again = await openStore(root, { latheDataDir: null });
    try {
      const row = again.rows(kept.table).find((r) => Object.entries(kept.key).every(([k, v]) => r[k] === v));
      expect(row?.[kept.column]).toBe(given(kept));
    } finally {
      await again.close();
    }
  });
});
