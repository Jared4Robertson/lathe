// What `npm run generate` writes from the records is what is on disk: each generated file equals a fresh generation,
// no generated file is left that no output makes, nothing is left to scaffold, and each command's and query's
// definition takes its identity from the generated file alone.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GENERATED_HEADER, GENERATED_ROOTS } from '../scripts/generate/output.ts';
import { generatedFiles, scaffoldFiles } from '../scripts/generate/outputs.ts';
import { COMMAND_ONLY, formDescription } from '../scripts/generate/fields.ts';
import { readIdentities } from '../scripts/generate/identities.ts';
import { ALL_COMMANDS, ALL_QUERIES } from '../src/commands.ts';
import { PACKAGE_DIR } from '../src/index.ts';

const REPO = path.join(PACKAGE_DIR, '..');
const read = (file: string) => readFileSync(path.join(REPO, file), 'utf8');

/** Every file under the generated roots that starts with the generated header, from the repo root. */
function generatedOnDisk(dir: string): string[] {
  return readdirSync(path.join(REPO, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(REPO, rel)).isDirectory()) return name === 'node_modules' ? [] : generatedOnDisk(rel);
    return name.endsWith('.ts') && read(rel).startsWith(GENERATED_HEADER) ? [rel] : [];
  });
}

describe('LA-STD-CODE-R11-T01 the generated files are a fresh generation from the records, and each definition spreads its generated identity', () => {
  let files: Map<string, string>;
  beforeAll(async () => {
    files = await generatedFiles(REPO);
  });

  it('writes each generated file as a fresh generation would (npm --prefix lathe run generate)', () => {
    expect(files.size).toBeGreaterThan(50);
    for (const [file, text] of files) expect(read(file), file).toBe(text);
  });

  it('gives the app\'s form fields no description of what the command does with a value (a list replaces, null clears)', () => {
    const descriptions = [...files].filter(([file]) => file.endsWith('/fields.generated.ts')).flatMap(([, text]) => [...text.matchAll(/description: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]));
    expect(descriptions.length).toBeGreaterThan(100);
    expect(descriptions.filter((d) => COMMAND_ONLY.test(d))).toEqual([]);
    expect(formDescription('The integrations it exchanges with. Replaces the list.')).toBe('The integrations it exchanges with.');
    expect(formDescription('The packages it uses; the list replaces the list.')).toBe('The packages it uses.');
    expect(ALL_COMMANDS.some((d) => Object.values(d.input).some((f) => 'description' in f && /Replaces the list\./.test(f.description)))).toBe(true);
  });

  it('leaves no generated file that no output makes, and nothing to scaffold', () => {
    const stale = GENERATED_ROOTS.flatMap(generatedOnDisk).filter((file) => !files.has(file));
    expect(stale).toEqual([]);
    expect([...scaffoldFiles(REPO).keys()]).toEqual([]);
  });

  it('gives each definition its identity by spreading it, with none of its keys written by hand', () => {
    const identities = readIdentities(REPO);
    expect(identities.map((d) => d.id).sort()).toEqual([...ALL_COMMANDS, ...ALL_QUERIES].map((d) => d.id).sort());
    const wrong = identities.flatMap((d) => {
      const text = read(d.file);
      // A command is written `satisfies CommandDefinition<T>` (its route kept literal for the app), a query annotated.
      const start = text.search(new RegExp(`^export const ${d.constant}(: QueryDefinition<.*)? = \\{$`, 'm'));
      const body = start < 0 ? '' : text.slice(start, text.indexOf('\n}', start));
      if (!body) return [`${d.file} defines no ${d.constant}`];
      return [
        ...(body.includes(`\n  ...${d.identity},\n`) ? [] : [`${d.constant} does not spread ${d.identity}`]),
        ...[...body.matchAll(/^  (id|slice|name|description|method|route)\b/gm)].map((m) => `${d.constant} writes its ${m[1]} by hand`),
      ];
    });
    expect(wrong).toEqual([]);
  });

  it('names each command\'s handler and each query\'s run function as its handler record does', () => {
    const handlers = new Map(readIdentities(REPO).map((d) => [d.id, d.handler]));
    expect(ALL_COMMANDS.filter((d) => d.handler.name !== handlers.get(d.id)).map((d) => `${d.id} ${d.handler.name}`)).toEqual([]);
    expect(ALL_QUERIES.filter((d) => d.run.name !== handlers.get(d.id)).map((d) => `${d.id} ${d.run.name}`)).toEqual([]);
  });
});

describe('LA-STD-CODE-R11-T02 a command or query with records and no definition yet is scaffolded to spread its identity', () => {
  const lines = (rows: object[]) => `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`;
  const repo = mkdtempSync(path.join(tmpdir(), 'lathe-generate-'));
  const tables: Record<string, object[]> = {
    entity: [{ id: 'XX-A1-EN1', aggregate_id: 'XX-A1' }],
    command: [{ id: 'XX-CMD1', entity_id: 'XX-A1-EN1', description: "Adds a widget, refused when it's there." }],
    command_handler: [{ id: 'XX-CMD1-H', command_id: 'XX-CMD1', title: 'addWidget', file: 'lathe/src/demo/widget/commands/add-widget.ts' }],
    cli_command: [{ id: 'XX-CMD1-CLI', command_id: 'XX-CMD1', title: 'lathe widget add-widget', mcp_tool: 'widget_add_widget' }],
    query: [{ id: 'XX-QRY1', read_model_id: 'XX-RM1', description: 'Reads a widget.' }],
    query_handler: [{ id: 'XX-QRY1-H', query_id: 'XX-QRY1', title: 'getWidget', file: 'lathe/src/demo/widget/queries.ts' }],
    cli_query: [{ id: 'XX-QRY1-CLI', query_id: 'XX-QRY1', title: 'lathe widget get-widget', mcp_tool: 'widget_get_widget' }],
    endpoint: [
      { id: 'XX-EP1', command_id: 'XX-CMD1', title: 'POST /api/widget/add-widget', method: 'POST', route: '/api/widget/add-widget' },
      { id: 'XX-EP401', query_id: 'XX-QRY1', title: 'GET /api/widget/get-widget', method: 'GET', route: '/api/widget/get-widget' },
    ],
    endpoint_handler: [
      { id: 'XX-EP1-H', endpoint_id: 'XX-EP1', title: 'ADD_WIDGET_IDENTITY', file: 'lathe/src/demo/widget/commands/identities.generated.ts' },
      { id: 'XX-EP401-H', endpoint_id: 'XX-EP401', title: 'GET_WIDGET_IDENTITY', file: 'lathe/src/demo/widget/queries.generated.ts' },
    ],
  };
  mkdirSync(path.join(repo, 'data'));
  for (const [name, rows] of Object.entries(tables)) writeFileSync(path.join(repo, 'data', `${name}.jsonl`), lines(rows));
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('generates its identity, with the slice\'s aggregate, and scaffolds its definition spreading it, with an empty input and handler', async () => {
    const files = await generatedFiles(repo);
    expect(files.get('lathe/src/demo/widget/commands/identities.generated.ts')).toContain(`export const ADD_WIDGET_IDENTITY = {
  id: 'XX-CMD1',
  slice: { aggregate: 'XX-A1', name: 'widget' },
  name: 'add-widget',
  description: 'Adds a widget, refused when it\\'s there.',
  method: 'POST',
  route: '/api/widget/add-widget',
} as const;`);
    expect(files.get('lathe/src/demo/widget/queries.generated.ts')).toContain("slice: { aggregate: 'XX-A1', name: 'widget' },");
    expect(files.get('lathe/src/demo/widget/commands/index.ts')).toContain('export const WIDGET_COMMANDS = [\n  ADD_WIDGET,\n] as const satisfies readonly AnyCommand[];');
    expect(files.get('lathe/src/commands.ts')).toContain("import { GET_WIDGET } from './demo/widget/queries.ts';");
    const scaffolds = scaffoldFiles(repo);
    expect(scaffolds.get('lathe/src/demo/widget/commands/add-widget.ts')).toContain('export const ADD_WIDGET = {\n  ...ADD_WIDGET_IDENTITY,\n  input: {},\n  handler: addWidget,\n} satisfies CommandDefinition<AddWidget>;');
    expect(scaffolds.get('lathe/src/demo/widget/queries.ts')).toContain('export const GET_WIDGET: QueryDefinition<Record<string, never>, never, unknown> = {\n  ...GET_WIDGET_IDENTITY,');
  });

  it('refuses records that disagree, naming each', async () => {
    writeFileSync(path.join(repo, 'data', 'endpoint.jsonl'), lines([{ ...tables.endpoint[0], route: '/api/widget/add' }, tables.endpoint[1]]));
    await expect(generatedFiles(repo)).rejects.toThrow('XX-EP1 is POST /api/widget/add; lathe widget add-widget is POST /api/widget/add-widget');
  });
});
