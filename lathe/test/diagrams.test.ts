// Tests for the Modeling domain (LA-MOD): CSV diagrams, their checks and API, and the record rules.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DuckDBInstance } from '@duckdb/node-api';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Problem, type Workspace } from '../src/index.ts';
import { handleApi, watchTargets } from '../src/server/api.ts';
import { createDiagram, listDiagrams, loadDiagram, slugify } from '../src/server/diagrams.ts';
import type { DiagramModel } from '../src/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures', 'diagrams');
const MODEL = path.join(FIXTURES, 'model');
const REPO = path.resolve(HERE, '..', '..');

// Each test that writes gets its own copy of the fixture diagrams, as a product repo whose
// diagrams folder is the default `diagrams/`.
const temps: string[] = [];
function tempRepo(withDiagrams = true): { root: string; diagramsDir: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-diagrams-'));
  temps.push(root);
  const diagramsDir = path.join(root, 'diagrams');
  if (withDiagrams) cpSync(MODEL, diagramsDir, { recursive: true });
  return { root, diagramsDir };
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// A snapshot of every file under a folder, to show that a refused request wrote nothing.
function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const file = path.join(entry.parentPath, entry.name);
      files[path.relative(dir, file)] = readFileSync(file, 'utf8');
    }
  }
  return files;
}

// A fake request and response for handleApi.
async function callApi(root: string, method: string, pathname: string, body?: unknown) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as unknown as IncomingMessage;
  req.method = method;
  const headers: Record<string, string> = {};
  let sent = '';
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    end(chunk?: string) {
      sent = chunk ?? '';
    },
  } as unknown as ServerResponse;
  const handled = await handleApi(root, req, res, pathname);
  return { handled, status: res.statusCode, headers, body: sent ? JSON.parse(sent) : undefined };
}

const problemsOf = (model: DiagramModel) => model.checks.message;

describe('diagram checks (lathe/diagrams/checks.sql)', () => {
  it('LA-MOD-T01 A clean diagram passes every check', async () => {
    const model = await loadDiagram(MODEL, 'clean');
    expect(model.checks).toEqual({ ok: true, message: 'All checks passed' });
    expect(model.terms).toHaveLength(8);
    expect(model.links).toHaveLength(6);
  });

  it('LA-MOD-T02 Two terms with the same name are reported', async () => {
    const model = await loadDiagram(MODEL, 'duplicate-term');
    expect(model.checks.ok).toBe(false);
    expect(problemsOf(model)).toContain('Duplicate term: Shelf');
  });

  it('LA-MOD-T03 A link to a term that does not exist is reported', async () => {
    const message = problemsOf(await loadDiagram(MODEL, 'unknown-link-term'));
    expect(message).toContain('Link names an unknown term: Shelf contains Ghost');
    expect(message).toContain('Link names an unknown term: Phantom serves Shelf');
    expect(message).not.toContain('Shelf contains Book');
  });

  it('LA-MOD-T04 A part in two aggregates is reported', async () => {
    const message = problemsOf(await loadDiagram(MODEL, 'two-aggregates'));
    expect(message).toMatch(/Part in more than one aggregate: Book \(in (Shelf, Box|Box, Shelf)\)/);
  });

  it('LA-MOD-T05 Only aggregates contain things, and only entities or value objects', async () => {
    const message = problemsOf(await loadDiagram(MODEL, 'bad-containment'));
    expect(message).toContain('Bad containment: Book contains Page');
    expect(message).toContain('Bad containment: Shelf contains Shelved');
    expect(message).toContain('2 problem(s)');
  });

  it('LA-MOD-T06 Kinds, contexts, statuses and relations outside the fixed lists are reported', async () => {
    const message = problemsOf(await loadDiagram(MODEL, 'unknown-values'));
    expect(message).toContain('Unknown kind, context or status: Gadget');
    expect(message).toContain('Unknown kind, context or status: Elsewhere');
    expect(message).toContain('Unknown kind, context or status: Maybe');
    expect(message).toContain('Unknown relation or status: Shelf likes Maybe');
    expect(message).toContain('Unknown relation or status: Shelf serves Maybe');
    expect(message).not.toContain(': Shelf;');
  });

  it('LA-MOD-T07 Aggregates raise domain events, and only domain events change things', async () => {
    const message = problemsOf(await loadDiagram(MODEL, 'bad-event-link'));
    expect(message).toContain('Bad event link: Book raises Shelved');
    expect(message).toContain('Bad event link: Shelf raises Book');
    expect(message).toContain('Bad event link: Shelf changes Book');
    expect(message).not.toContain('Shelved changes Book');
    expect(message).toContain('3 problem(s)');
  });

  it('LA-MOD-T08 An includes link that gives a topic two parents, or joins a non-topic, is reported', async () => {
    const message = problemsOf(await loadDiagram(MODEL, 'topic-two-parents'));
    expect(message).toContain('Topic with more than one parent: Notes');
    expect(message).toContain('Bad includes link: Writing includes Pen');
    expect(message).toContain('2 problem(s)');
  });

  it('LA-MOD-T09 A people-and-tools term with no links is reported', async () => {
    const message = problemsOf(await loadDiagram(MODEL, 'unlinked-term'));
    expect(message).toContain('Term with no links: Loner');
    expect(message).not.toContain('Aside');
    expect(message).toContain('1 problem(s)');
  });

  it('LA-MOD-T10 Loading a diagram reports every problem, not just the first', async () => {
    const model = await loadDiagram(MODEL, 'many-problems');
    expect(model.checks.ok).toBe(false);
    expect(problemsOf(model)).toContain('3 problem(s)');
    expect(problemsOf(model)).toContain('Duplicate term: Shelf');
    expect(problemsOf(model)).toContain('Unknown kind, context or status: Gadget');
    expect(problemsOf(model)).toContain('Link names an unknown term: Shelf serves Ghost');
    // The terms and links are still returned, so the page can draw what is there.
    expect(model.terms.map((t) => t.name)).toEqual(['Shelf', 'Shelf', 'Gadget']);
  });

  it('LA-MOD-T11 The diagrams in this repo pass their checks', async () => {
    const dir = path.join(REPO, 'model');
    for (const { slug } of await listDiagrams(dir)) {
      expect({ slug, checks: (await loadDiagram(dir, slug)).checks }).toEqual({ slug, checks: { ok: true, message: 'All checks passed' } });
    }
  });
});

describe('diagram files', () => {
  it('LA-MOD-T12 Terms and links are plain CSV files that DuckDB reads without the app', async () => {
    expect(await listDiagrams(MODEL)).toEqual([
      { slug: 'clean', title: 'Clean', description: 'A small diagram that passes every check, with a comma in its description.' },
      { slug: 'many-problems', title: 'Many problems', description: 'Breaks several rules at once.' },
    ]);
    const model = await loadDiagram(MODEL, 'clean');
    expect(model.terms[0]).toEqual({
      name: 'Shelf',
      kind: 'aggregate',
      context: 'people_and_tools',
      status: 'decided',
      definition: 'Holds books, in order.',
    });
    expect(model.links[3]).toEqual({
      source: 'Book shelved',
      relation: 'prompts',
      target: 'Reader',
      cardinality: null,
      status: 'open',
      note: 'maybe',
    });

    // The same files answer a plain SQL query, with no Lathe code involved.
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    try {
      const file = path.join(MODEL, 'clean', 'links.csv').replaceAll("'", "''");
      const rows = (await connection.runAndReadAll(`SELECT target FROM '${file}' WHERE relation = 'contains' ORDER BY target`)).getRowObjectsJson();
      expect(rows).toEqual([{ target: 'Book' }, { target: 'Label' }]);
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  });

  it('LA-MOD-T13 A diagrams folder with no registry lists no diagrams', async () => {
    const { diagramsDir } = tempRepo(false);
    expect(await listDiagrams(diagramsDir)).toEqual([]);
    mkdirSync(diagramsDir);
    writeFileSync(path.join(diagramsDir, 'diagrams.csv'), 'slug,title,description\n');
    expect(await listDiagrams(diagramsDir)).toEqual([]);
  });
});

describe('creating a diagram', () => {
  it('LA-MOD-T14 A slug is lowercase letters, numbers and hyphens, derived from the title', () => {
    expect(slugify('People and Tools')).toBe('people-and-tools');
    expect(slugify('  SDLC: brainstorm #2!  ')).toBe('sdlc-brainstorm-2');
    expect(slugify('!!!')).toBe('');
    expect(slugify('x'.repeat(80))).toHaveLength(60);
    for (const title of ['Ünïcödé “quotes”', 'a/b\\c', '../escape', 'Tabs\tand\nlines']) {
      expect(slugify(title)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('drops accents from letters instead of splitting the word', () => {
    expect(slugify('Café déjà vu')).toBe('cafe-deja-vu');
  });

  it('LA-MOD-T15 A new diagram gets headed, empty CSV files and one registry row', async () => {
    const { diagramsDir } = tempRepo();
    const before = readFileSync(path.join(diagramsDir, 'diagrams.csv'), 'utf8');
    const created = await createDiagram(diagramsDir, 'Lending, "loans" and returns', 'Who has what.');
    expect(created).toEqual({ slug: 'lending-loans-and-returns', title: 'Lending, "loans" and returns', description: 'Who has what.' });
    const dir = path.join(diagramsDir, created.slug);
    expect(readFileSync(path.join(dir, 'terms.csv'), 'utf8')).toBe('name,kind,context,status,definition\n');
    expect(readFileSync(path.join(dir, 'links.csv'), 'utf8')).toBe('source,relation,target,cardinality,status,note\n');
    expect(readFileSync(path.join(diagramsDir, 'diagrams.csv'), 'utf8')).toBe(
      `${before}lending-loans-and-returns,"Lending, ""loans"" and returns",Who has what.\n`,
    );
    expect((await listDiagrams(diagramsDir)).at(-1)).toEqual(created);
    expect(await loadDiagram(diagramsDir, created.slug)).toEqual({
      terms: [],
      links: [],
      checks: { ok: true, message: 'All checks passed' },
    });
  });

  it('LA-MOD-T16 The first diagram in a new repo creates the registry', async () => {
    const { diagramsDir } = tempRepo(false);
    await createDiagram(diagramsDir, 'First', '');
    expect(readFileSync(path.join(diagramsDir, 'diagrams.csv'), 'utf8')).toBe('slug,title,description\nfirst,First,\n');
    expect(await listDiagrams(diagramsDir)).toEqual([{ slug: 'first', title: 'First', description: null }]);
  });

  it('LA-MOD-T17 A clashing or empty title is refused, says why, and writes nothing', async () => {
    const { diagramsDir } = tempRepo();
    // A folder with the slug's name counts as taken, even when it is not registered.
    mkdirSync(path.join(diagramsDir, 'stray'));
    const before = snapshot(diagramsDir);
    await expect(createDiagram(diagramsDir, 'Clean', '')).rejects.toThrow('A diagram called "clean" already exists.');
    await expect(createDiagram(diagramsDir, 'CLEAN!', 'Same slug.')).rejects.toThrow('"clean"');
    await expect(createDiagram(diagramsDir, 'Stray', '')).rejects.toThrow('A diagram called "stray" already exists.');
    await expect(createDiagram(diagramsDir, '   ', '')).rejects.toThrow('at least one letter or number');
    await expect(createDiagram(diagramsDir, '?!', '')).rejects.toThrow('at least one letter or number');
    expect(snapshot(diagramsDir)).toEqual(before);
  });
});

describe('the diagram API', () => {
  it('LA-MOD-T18 POST /api/diagrams creates a diagram from a title and optional description', async () => {
    const { root, diagramsDir } = tempRepo();
    const created = await callApi(root, 'POST', '/api/diagrams', { title: '  Shop floor  ', description: ' Machines and jobs. ' });
    expect(created).toMatchObject({ handled: true, status: 201, body: { slug: 'shop-floor', title: 'Shop floor', description: 'Machines and jobs.' } });
    expect(created.headers['content-type']).toBe('application/json');
    const withoutDescription = await callApi(root, 'POST', '/api/diagrams', { title: 'Bare' });
    expect(withoutDescription).toMatchObject({ status: 201, body: { slug: 'bare', title: 'Bare', description: '' } });
    expect(existsSync(path.join(diagramsDir, 'shop-floor', 'terms.csv'))).toBe(true);

    const list = await callApi(root, 'GET', '/api/diagrams');
    expect(list.status).toBe(200);
    expect(list.body.map((d: { slug: string }) => d.slug)).toEqual(['clean', 'many-problems', 'shop-floor', 'bare']);
  });

  it('LA-MOD-T19 POST /api/diagrams refuses a clashing or empty title with 400 and writes nothing', async () => {
    const { root, diagramsDir } = tempRepo();
    const before = snapshot(diagramsDir);
    expect(await callApi(root, 'POST', '/api/diagrams', { title: 'Many problems' })).toMatchObject({
      status: 400,
      body: { error: 'A diagram called "many-problems" already exists.' },
    });
    expect(await callApi(root, 'POST', '/api/diagrams', {})).toMatchObject({ status: 400, body: { error: expect.stringContaining('letter or number') } });
    expect(await callApi(root, 'POST', '/api/diagrams', { title: '***' })).toMatchObject({ status: 400 });
    expect(snapshot(diagramsDir)).toEqual(before);
  });

  it('LA-MOD-T20 GET /api/diagrams/<slug> returns the diagram with its check result, or 404', async () => {
    const { root } = tempRepo();
    const clean = await callApi(root, 'GET', '/api/diagrams/clean');
    expect(clean.status).toBe(200);
    expect(clean.body.checks).toEqual({ ok: true, message: 'All checks passed' });
    expect(clean.body.terms).toHaveLength(8);

    const broken = await callApi(root, 'GET', '/api/diagrams/many-problems');
    expect(broken.status).toBe(200);
    expect(broken.body.checks).toMatchObject({ ok: false, message: expect.stringContaining('3 problem(s)') });

    // Registered slugs only: an unregistered folder, a bad slug or an unknown one is not found.
    for (const slug of ['duplicate-term', 'nope', 'Clean', '..']) {
      expect(await callApi(root, 'GET', `/api/diagrams/${slug}`)).toMatchObject({ status: 404, body: { error: expect.stringContaining('No diagram') } });
    }
    expect(await callApi(root, 'DELETE', '/api/diagrams/clean')).toMatchObject({ status: 405 });
    expect(await callApi(root, 'GET', '/api/other')).toMatchObject({ handled: false });
  });

  it('LA-MOD-T21 A change in the diagrams folder is announced as model:changed', () => {
    const { root, diagramsDir } = tempRepo();
    expect(watchTargets(root)).toContainEqual({ dir: diagramsDir, event: 'model:changed' });
    // This repo names its diagrams folder model/ in lathe.config.json.
    expect(watchTargets(REPO)).toContainEqual({ dir: path.join(REPO, 'model'), event: 'model:changed' });
  });
});

describe('drawing a diagram (app/src/layout.ts)', () => {
  it('LA-MOD-T22 Open terms and open links are marked, and aggregates contain their parts', async () => {
    // Imported by path so that the lathe package's type check does not follow it into the app.
    const layoutFile = path.join(REPO, 'app', 'src', 'layout.ts');
    const { layoutModel } = (await import(pathToFileURL(layoutFile).href)) as {
      layoutModel: (model: DiagramModel) => Promise<{
        nodes: { id: string; parentId?: string; data: { term: string; status: string } }[];
        edges: { data: { link: { source: string; target: string }; uncertain: boolean } }[];
      }>;
    };
    const { nodes, edges } = await layoutModel(await loadDiagram(MODEL, 'clean'));

    const node = (term: string) => nodes.find((n) => n.data.term === term)!;
    expect(node('Book').parentId).toBe('Shelf');
    expect(node('Label').parentId).toBe('Shelf');
    expect(node('Reader').data.status).toBe('open');
    expect(node('Shelf').data.status).toBe('decided');

    const edge = (source: string, target: string) => edges.find((e) => e.data.link.source === source && e.data.link.target === target)!;
    expect(edge('Book shelved', 'Reader').data.uncertain).toBe(true);
    expect(edge('Shelf', 'Book shelved').data.uncertain).toBe(false);

    // A link to a part placed in two aggregates is ambiguous, so it is marked too.
    const ambiguous = await loadDiagram(MODEL, 'two-aggregates');
    ambiguous.terms.push({ name: 'Reader', kind: 'term', context: 'making_software', status: 'decided', definition: '' });
    ambiguous.links.push({ source: 'Reader', relation: 'serves', target: 'Book', cardinality: null, status: 'decided', note: null });
    const laid = await layoutModel(ambiguous);
    expect(laid.edges.every((e) => e.data.uncertain)).toBe(true);
  });
});

// ---------- spec records ----------

const workspaces: Record<string, Workspace> = {};
beforeAll(async () => {
  for (const name of ['records-good', 'records-broken']) workspaces[name] = await loadWorkspace(path.join(FIXTURES, name));
});
const broken = (check: string) =>
  workspaces['records-broken'].problems
    .filter((p: Problem) => p.check === check)
    .map((p) => p.record)
    .sort();

describe('spec records', () => {
  it('LA-MOD-T23 A record is one Markdown file whose header holds its fields and links', () => {
    const ws = workspaces['records-good'];
    expect(ws.problems).toEqual([]);
    const uc = ws.records.find((r) => r.id === 'MX-D-UC01')!;
    expect(uc).toMatchObject({
      kind: 'use_case',
      title: 'Make a mark',
      parent: 'MX-D',
      product: 'MX',
      domain: 'MX-D',
      path: 'specs/mx/d/01-define/use-cases/UC01-make-a-mark.md',
      fields: { actor: 'Writer' },
    });
    expect(uc.body.trim()).toBe('A writer makes a mark.');
    expect(ws.links).toContainEqual({ source: 'MX-D-UC01', relation: 'applies', target: 'MX-D-DR01' });
    expect(ws.records).toHaveLength(8);
  });

  it('LA-MOD-T24 A record points at the code that builds it (file) and the code that proves it (run_by)', () => {
    const ws = workspaces['records-good'];
    expect(ws.records.find((r) => r.id === 'MX-D-C01')!.fields.file).toBe('code/mark_service.txt');
    expect(ws.records.find((r) => r.id === 'MX-D-T01')!.fields.run_by).toBe('code/mark_test.txt');
    expect(ws.coverage).toEqual([expect.objectContaining({
      domain: 'MX-D',
      obligations: expect.arrayContaining([
        expect.objectContaining({ kind: 'requirement', proved: 1 }),
        expect.objectContaining({ kind: 'domain_rule', proved: 1 }),
      ]),
      gaps: [],
    })]);
  });

  it('LA-MOD-T25 Moving or renaming record files does not change what they mean, and README.md is ignored', async () => {
    const { root } = tempRepo(false);
    // Put every record of the good workspace flat in one oddly named folder, with a README.md that is not a record.
    const from = path.join(FIXTURES, 'records-good');
    cpSync(path.join(from, 'code'), path.join(root, 'code'), { recursive: true });
    const flat = path.join(root, 'specs', 'everything-here');
    mkdirSync(flat, { recursive: true });
    let n = 0;
    for (const entry of readdirSync(path.join(from, 'specs'), { recursive: true, withFileTypes: true })) {
      if (entry.isFile() && entry.name !== 'README.md') cpSync(path.join(entry.parentPath, entry.name), path.join(flat, `record-${++n}.md`));
    }
    writeFileSync(path.join(flat, 'README.md'), 'Just notes, with no header.\n');

    const moved = await loadWorkspace(root);
    const original = workspaces['records-good'];
    const meaning = (ws: Workspace) => ws.records.map(({ path: _path, ...r }) => r).sort((a, b) => a.id.localeCompare(b.id));
    expect(moved.problems).toEqual([]);
    expect(meaning(moved)).toEqual(meaning(original));
    expect(moved.links).toEqual(expect.arrayContaining(original.links));
    expect(moved.coverage).toEqual(original.coverage);
  });

  it('LA-MOD-T26 Two records with the same ID are an error, even in different products', () => {
    expect(broken('duplicate-id')).toEqual(['BA-D-A1']);
  });

  it('LA-MOD-T27 An ID that does not match the pattern is an error', () => {
    expect(broken('bad-id')).toEqual(['ba-d-a2']);
  });

  it('LA-MOD-T28 A missing, unknown, disallowed or looping parent is an error, as is a product with a parent', () => {
    expect(broken('missing-parent')).toEqual(['BA-D-A3']);
    expect(broken('unknown-parent')).toEqual(['BA-D-A4']);
    expect(broken('parent-kind-not-allowed')).toEqual(['BA-D-A5', 'BA-D-A6', 'BA-D-DR01']);
    expect(broken('parent-cycle')).toEqual(['BA-D-A5', 'BA-D-A6']);
    expect(broken('product-has-parent')).toEqual(['BB']);
  });

  it('LA-MOD-T29 A record without a title, a known kind or its kind\'s required fields is an error', () => {
    expect(broken('missing-title')).toEqual(['BA-D-A7']);
    expect(broken('unknown-kind')).toEqual(['BA-D-W01']);
    expect(broken('missing-required-field')).toEqual(['BA-D-UC01']);
    const missing = workspaces['records-broken'].problems.find((p) => p.check === 'missing-required-field')!;
    expect(missing.message).toContain('actor');
  });

  it('LA-MOD-T30 A link to a record that does not exist is an error', () => {
    expect(broken('dangling-link')).toEqual(['BA-D-UC02']);
  });

  it('LA-MOD-T31 A link whose relation is unknown or not allowed for its kinds is an error', () => {
    expect(broken('relation-not-allowed')).toEqual(['BA-D-V01']);
    expect(broken('unknown-relation')).toEqual(['BA-D-V01']);
  });

  it('LA-MOD-T32 A test whose run_by file is missing or lacks its ID is an error; a missing component file is only a warning', () => {
    expect(broken('test-file-missing')).toEqual(['BA-D-T01']);
    expect(broken('proof-not-in-file')).toEqual(['BA-D-T02']);
    const later = workspaces['records-broken'].problems.filter((p) => p.record === 'BA-D-C01');
    expect(later).toEqual([expect.objectContaining({ severity: 'warning', check: 'component-file-missing' })]);
  });

  it("LA-MOD-T33 Every rule and requirement in Lathe's own specs states its rule with MUST, SHOULD or MAY under a short title", async () => {
    // Lathe's own records only: other products in this repo are examples with their own owners.
    const ws = await loadWorkspace(REPO);
    const rules = ws.records.filter((r) => r.product === 'LA' && (r.kind === 'requirement' || r.kind === 'domain_rule'));
    expect(rules.length).toBeGreaterThan(0);
    const unstated = rules.filter((r) => !/\b(MUST|SHOULD|MAY)\b/.test(r.body)).map((r) => r.id);
    const longTitles = rules.filter((r) => r.title.split(/\s+/).length > 15).map((r) => r.id);
    expect({ unstated, longTitles }).toEqual({ unstated: [], longTitles: [] });
  });
});
