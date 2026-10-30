// Routes, traced both ways between the records and the code, read as text.
//
// Forward: an endpoint's method and route appear in its endpoint handler's file, and a view's route in the file of a
// UI component that renders it (the checks endpoint-route-not-in-file and view-route-not-in-file read route_facts).
// Back: every route the code serves, found in the endpoint handlers' files and the router files lathe.config.json
// names, has an endpoint or a view with that route (the coverage gap route-without-record reads served_routes).
//
// One normal form compares routes however they are written (normalRoute): the path alone (a query string or fragment
// picks a state within a page, not another page), every parameter as {} whatever its name or syntax (`<id>`, `:id`,
// `{id}`, `[id]`, `${id}`, a regular expression's group or character class), no trailing slash but the root's.
//
// What counts as naming a route (mentionedRoutes): a path anywhere in the file's text, in code, a string or a comment
// (`/tools/<id>`, `/loans/:loanId/return`), with at least one segment or quoted when it is the root (`'/'`), and a
// regular expression literal that matches only a path (`/^\/loans\/(\d+)\/return$/`). An endpoint's method counts
// when an HTTP method (GET, POST, ...) is written in capitals, or called as `.get(`, on the route's line or within two
// lines of it.
//
// What counts as serving a route (servedRoutes) is stricter, and read in code only, never in comments: a route string,
// template or regular expression literal
// - as the first argument of a method call such as `app.get('/tools', ...)` or `router.post(...)`: that method;
// - as the value of a `path`, `pattern` or `route` key or attribute (`{ path: '/x' }`, `<Route path="/x">`), or
//   compared with `===`, `==`, `!==` or `!=` (`pathname === '/api/history'`): the method written as a string literal
//   (`'GET'`, `method: 'POST'`) on the nearest line within two, or any method when there is none;
// - assigned to a constant whose name ends in PATH or ROUTE (`const HOME_PATH = '/'`): any method.
// It does not recognize a route built at run time (from parts, by a function, or matched by prefix with startsWith),
// a route table in a configuration file, a framework's file-system routes (a pages/ or app/ folder) or a
// language whose strings and comments are not written as JavaScript's are.
import { glob, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { DuckDBConnection } from '@duckdb/node-api';
import { otherProductHolds, type LatheConfig } from '../config.ts';
import type { GapRule } from '../coverage.ts';
import type { Store } from '../platform/data/store.ts';
import { keptByText } from '../platform/data/kept-by-text.ts';
import { walkFiles } from './source-files.ts';

/** The HTTP methods an endpoint may have, in capitals. */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
const METHOD_WORD = new RegExp(`\\b(${HTTP_METHODS.join('|')})\\b`, 'g');
const METHOD_CALL = new RegExp(`\\.(${HTTP_METHODS.map((m) => m.toLowerCase()).join('|')})\\s*\\(`, 'g');
/** How many lines from a route its method may be written. */
const METHOD_REACH = 2;

// A parameter, written any of the ways routes write one.
const PARAM = String.raw`\$\{[^}]*\}|\{[^}/]*\}|<[^>/\s]*>|\[[^\]/\s]*\]|:[A-Za-z_]\w*`;
const SEGMENT = String.raw`(?:[A-Za-z0-9_.~-]|${PARAM})+`;
// A path in text: not inside a word, a file path (lathe/src), a URL (http://host/x) or after another parameter.
const PATH_IN_TEXT = new RegExp(String.raw`(?<![A-Za-z0-9_.:/\\$}>\]-])/(?:${SEGMENT}(?:/${SEGMENT})*)?/?`, 'g');

/**
 * A route in its normal form: the path alone, each parameter as {}, no repeated or trailing slash (but the root's).
 * `/tools/{toolId}/damage`, `/tools/:id/damage` and `/tools/<tool-id>/damage/` are all `/tools/{}/damage`.
 */
export function normalRoute(route: string): string {
  let text = route.trim();
  // The path ends at a query string or fragment outside a parameter.
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{' || c === '<' || c === '[') depth++;
    else if ((c === '}' || c === '>' || c === ']') && depth > 0) depth--;
    else if ((c === '?' || c === '#') && depth === 0) { text = text.slice(0, i); break; }
  }
  text = text.replace(new RegExp(PARAM, 'g'), '{}').replace(/\/{2,}/g, '/');
  if (!text.startsWith('/')) text = `/${text}`;
  return text.length > 1 ? text.replace(/\/+$/, '') : text;
}

/** The route a regular expression literal's body matches, when it matches one path (with parameters) and nothing else. */
export function regexRoute(body: string): string | null {
  let text = body.replace(/^\^/, '').replace(/\$$/, '').replace(/\\\/\?$/, '');
  if (!text.startsWith('\\/') && !text.startsWith('/')) return null;
  // Groups, innermost first, and one-segment classes and escapes, become parameters.
  for (let before = ''; before !== text;) {
    before = text;
    text = text.replace(/\((?:\?<\w+>|\?:)?[^()]*\)/g, '{}');
  }
  text = text
    .replace(/\[\^\\?\/\]\+/g, '{}')
    .replace(/\\[dw]\+/g, '{}')
    .replace(/\\([/.\-_~])/g, '$1');
  if (/[\\*+?|()[\]^$]/.test(text)) return null;
  return text;
}

interface Token {
  type: 'string' | 'regex' | 'comment';
  /** A string's or comment's text, or a regular expression's body. */
  text: string;
  /** The line it starts on, from 0. */
  line: number;
  start: number;
  end: number;
}

const REGEX_AFTER = /[(,=:[!&|?{};+\-*%<>~^]$|(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|throw|new)$/;

/** The strings, regular expression literals and comments of JavaScript-like text, with the code outside comments. */
function tokenize(text: string): { tokens: Token[]; code: string } {
  const tokens: Token[] = [];
  const code = text.split('');
  let line = 0;
  let i = 0;
  const lineAt = (from: number, to: number) => { for (let k = from; k < to; k++) if (text[k] === '\n') line++; };
  const blank = (from: number, to: number) => { for (let k = from; k < to; k++) if (code[k] !== '\n') code[k] = ' '; };
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && next === '/') {
      const end = text.indexOf('\n', i) === -1 ? text.length : text.indexOf('\n', i);
      tokens.push({ type: 'comment', text: text.slice(i + 2, end), line, start: i, end });
      blank(i, end);
      i = end;
      continue;
    }
    if (c === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? text.length : close + 2;
      tokens.push({ type: 'comment', text: text.slice(i + 2, close === -1 ? end : close), line, start: i, end });
      blank(i, end);
      lineAt(i, end);
      i = end;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const start = i;
      const startLine = line;
      let j = i + 1;
      let depth = 0;
      while (j < text.length) {
        const d = text[j];
        if (d === '\\') { j += 2; continue; }
        if (c === '`' && d === '$' && text[j + 1] === '{') { depth++; j += 2; continue; }
        if (c === '`' && depth > 0 && d === '}') { depth--; j++; continue; }
        if (d === c && depth === 0) break;
        if (d === '\n' && c !== '`') break;
        j++;
      }
      const end = Math.min(j + 1, text.length);
      tokens.push({ type: 'string', text: text.slice(start + 1, j), line: startLine, start, end });
      lineAt(start, end);
      i = end;
      continue;
    }
    if (c === '/') {
      const before = text.slice(Math.max(0, i - 12), i).replace(/\s+$/, '');
      if (before === '' || REGEX_AFTER.test(before)) {
        let j = i + 1;
        let inClass = false;
        while (j < text.length && text[j] !== '\n') {
          const d = text[j];
          if (d === '\\') { j += 2; continue; }
          if (d === '[') inClass = true;
          else if (d === ']') inClass = false;
          else if (d === '/' && !inClass) break;
          j++;
        }
        if (j < text.length && text[j] === '/') {
          let end = j + 1;
          while (end < text.length && /[a-z]/.test(text[end])) end++;
          tokens.push({ type: 'regex', text: text.slice(i + 1, j), line, start: i, end });
          i = end;
          continue;
        }
      }
    }
    i++;
  }
  return { tokens, code: code.join('') };
}

/** A route a file names, with the line it is on. */
interface Mention {
  normal: string;
  line: number;
}

/** The routes a file's text names, in code, strings or comments, each in normal form with its line. */
function mentionedRoutes(text: string, tokens: Token[]): Mention[] {
  const found: Mention[] = [];
  const lines = text.split('\n');
  lines.forEach((content, line) => {
    for (const match of content.matchAll(PATH_IN_TEXT)) {
      const raw = match[0].replace(/[.,-]+$/, '');
      if (raw === '/' || raw === '') {
        const quote = content[match.index - 1];
        if (!(quote === "'" || quote === '"' || quote === '`') || content[match.index + 1] !== quote) continue;
      }
      found.push({ normal: normalRoute(raw), line });
    }
  });
  for (const t of tokens) {
    if (t.type !== 'regex') continue;
    const route = regexRoute(t.text);
    if (route !== null) found.push({ normal: normalRoute(route), line: t.line });
  }
  return found;
}

/** The HTTP methods a file writes on each line: a method in capitals, or called as `.get(`. */
function methodsByLine(text: string): Set<string>[] {
  return text.split('\n').map((content) => {
    const methods = new Set<string>();
    for (const m of content.matchAll(METHOD_WORD)) methods.add(m[1]);
    for (const m of content.matchAll(METHOD_CALL)) methods.add(m[1].toUpperCase());
    return methods;
  });
}

/** A route the code serves, with the method it is served for (null: any). */
export interface ServedRoute {
  method: string | null;
  route: string;
  normal: string;
  line: number;
}

/** The routes a file's code serves (see the head of this file for the patterns), each once per method (kept by the text: nothing changes them). */
export const servedRoutes: (text: string) => readonly ServedRoute[] = keptByText(readServedRoutes);

// The routes a file's code serves (servedRoutes).
function readServedRoutes(text: string): ServedRoute[] {
  const { tokens, code } = tokenize(text);
  const lineStarts = [0];
  for (let k = 0; k < text.length; k++) if (text[k] === '\n') lineStarts.push(k + 1);
  // The method string literals in code ('GET', "post"), by line.
  const methodLiterals = new Map<number, string>();
  for (const t of tokens) {
    if (t.type === 'string' && (HTTP_METHODS as readonly string[]).includes(t.text.toUpperCase()) && /^[A-Za-z]+$/.test(t.text)) {
      if (!methodLiterals.has(t.line)) methodLiterals.set(t.line, t.text.toUpperCase());
    }
  }
  const nearestMethod = (line: number): string | null => {
    for (let d = 0; d <= METHOD_REACH; d++) {
      const at = methodLiterals.get(line - d) ?? methodLiterals.get(line + d);
      if (at) return at;
    }
    return null;
  };
  const served: ServedRoute[] = [];
  for (const t of tokens) {
    if (t.type === 'comment') continue;
    const route = t.type === 'regex' ? regexRoute(t.text) : t.text.startsWith('/') && !t.text.startsWith('//') && !/\s/.test(t.text) ? t.text : null;
    if (route === null) continue;
    const before = code.slice(lineStarts[t.line], t.start);
    const after = code.slice(t.end, t.end + 8);
    let method: string | null | undefined;
    const call = /\.(get|post|put|patch|delete|head|options|all)\s*\(\s*$/.exec(before);
    if (call) method = call[1] === 'all' ? null : call[1].toUpperCase();
    else if (/\b(?:path|pattern|route)\s*[:=]\s*\{?\s*$/.test(before) || /[=!]==?\s*$/.test(before) || /^\s*[=!]==?/.test(after)) method = nearestMethod(t.line);
    else if (/\b[A-Z][A-Z0-9_]*(?:PATH|ROUTE)\s*(?::[^=]+)?=\s*$/.test(before)) method = null;
    if (method === undefined) continue;
    const normal = normalRoute(route);
    if (served.some((s) => s.normal === normal && s.method === method)) continue;
    served.push({ method, route, normal, line: t.line + 1 });
  }
  return served;
}

/** What a file names: its routes, and the methods on each line. Read once per file, however many records ask. */
interface Named {
  mentions: Mention[];
  methods: Set<string>[];
}

// What a file names (kept by the text: nothing changes it).
const namedIn = keptByText(readNamed);

function readNamed(text: string): Named {
  // Only a regular expression that matches a path needs the text tokenized: one holds an escaped slash.
  return { mentions: mentionedRoutes(text, text.includes('\\/') ? tokenize(text).tokens : []), methods: methodsByLine(text) };
}

/** True when a file names the route, with the method on its line or within two lines of it when one is given. */
function namesRoute({ mentions: all, methods }: Named, route: string, method: string | null): boolean {
  const normal = normalRoute(route);
  const mentions = all.filter((m) => m.normal === normal);
  if (method === null) return mentions.length > 0;
  return mentions.some((m) => {
    for (let l = m.line - METHOD_REACH; l <= m.line + METHOD_REACH; l++) if (methods[l]?.has(method)) return true;
    return false;
  });
}

/** An endpoint's or a view's route, and whether the files of what implements it name it. */
interface RouteFact {
  record: string;
  kind: 'endpoint' | 'view';
  method: string | null;
  route: string;
  normal: string;
  /** The files read for it that exist, from the product root, joined by ", "; empty when none does. */
  files: string;
  /** Whether one of those files names the route (with the endpoint's method). */
  found: boolean;
}

/** A route the code serves: where, and the product whose coverage reports it when no record has it. */
interface ServedFact extends ServedRoute {
  product: string;
  file: string;
}

/**
 * The tables the route checks and gap read: route_facts, every endpoint's and view's route with whether its
 * implementing files name it, and served_routes, every route the code serves.
 */
export const ROUTE_FACT_TABLES_SQL = `
CREATE OR REPLACE TABLE route_facts (record VARCHAR NOT NULL, kind VARCHAR NOT NULL, method VARCHAR, route VARCHAR NOT NULL, normal VARCHAR NOT NULL, files VARCHAR NOT NULL, found BOOLEAN NOT NULL);
CREATE OR REPLACE TABLE served_routes (product VARCHAR NOT NULL, file VARCHAR NOT NULL, line INTEGER NOT NULL, method VARCHAR, route VARCHAR NOT NULL, normal VARCHAR NOT NULL);`;

/** The coverage gap for a route the code serves that no endpoint or view has. */
export const ROUTE_GAP_RULES: GapRule[] = [{
  name: 'route-without-record',
  stage: 'interaction-design',
  kinds: ['product', 'endpoint', 'view'],
  summary: 'A route the code serves that no endpoint or view has.',
  sql: () => `SELECT s.product AS id, 'The code serves ' || coalesce(s.method || ' ', '') || s.route || ' (' || s.file || ', line ' || s.line || '), but no '
  || CASE WHEN s.method IS NULL OR s.method = 'GET' THEN 'endpoint or view' ELSE 'endpoint' END || ' has that route; add one, or remove the route if nothing uses it.' AS message
FROM served_routes s
WHERE NOT EXISTS (SELECT 1 FROM route_facts r WHERE r.normal = s.normal
  AND ((r.kind = 'endpoint' AND (s.method IS NULL OR r.method = s.method)) OR (r.kind = 'view' AND (s.method IS NULL OR s.method = 'GET'))))`,
}];

/**
 * Reads what the route checks need from the code: each endpoint's and view's route against the files of what
 * implements it, and the routes served in the endpoint handlers' files and the router files the config names.
 */
export async function gatherRouteFacts({ root, routers }: Pick<LatheConfig, 'root' | 'routers'>, store: Store): Promise<{ facts: RouteFact[]; served: ServedFact[] }> {
  const texts = new Map<string, Promise<{ files: string[]; texts: string[] }>>();
  // A named file or folder: the files in it that exist, and their texts.
  const read = (file: string) => {
    let known = texts.get(file);
    if (!known) {
      known = (async () => {
        const resolved = path.resolve(root, file);
        const rel = path.relative(root, resolved);
        if (rel.startsWith('..') || path.isAbsolute(rel)) return { files: [], texts: [] };
        try {
          const info = await stat(resolved);
          const files = info.isFile() ? [rel] : info.isDirectory() ? await walkFiles(root, (_, name) => name === 'node_modules' || name === '.git', rel) : [];
          return { files, texts: await Promise.all(files.map((f) => readFile(path.join(root, f), 'utf8'))) };
        } catch {
          return { files: [], texts: [] };
        }
      })();
      texts.set(file, known);
    }
    return known;
  };
  const scopes = new Map(
    (await store.query<{ id: string; product_id: string | null }>('SELECT id, product_id FROM record_scope')).map((s) => [s.id, s.product_id]),
  );
  const handlers = store.rows('endpoint_handler').filter((h) => typeof h.file === 'string');
  const components = new Map(store.rows('ui_component').map((u) => [String(u.id), u.file]));
  const renderers = new Map<string, string[]>();
  for (const link of store.rows('renders')) {
    const file = components.get(String(link.source_id));
    if (typeof file === 'string') renderers.set(String(link.target_id), [...(renderers.get(String(link.target_id)) ?? []), file]);
  }
  const names = new Map<string, Named>();
  const namedBy = (file: string, text: string) => {
    let known = names.get(file);
    if (!known) names.set(file, (known = namedIn(text)));
    return known;
  };
  const check = async (record: string, kind: RouteFact['kind'], method: string | null, route: string, named: string[]): Promise<RouteFact> => {
    const files: string[] = [];
    let found = false;
    for (const file of named) {
      const got = await read(file);
      files.push(...got.files);
      if (!found) found = got.files.some((f, at) => namesRoute(namedBy(f, got.texts[at]), route, method));
    }
    return { record, kind, method, route, normal: normalRoute(route), files: [...new Set(files)].join(', '), found };
  };
  const handlerFiles = new Map(handlers.map((h) => [String(h.endpoint_id), String(h.file)]));
  const facts = await Promise.all([
    ...store.rows('endpoint').map((e) => {
      const file = handlerFiles.get(String(e.id));
      return check(String(e.id), 'endpoint', String(e.method), String(e.route), file === undefined ? [] : [file]);
    }),
    ...store.rows('view').filter((v) => typeof v.route === 'string' && v.route.trim() !== '').map((v) =>
      check(String(v.id), 'view', null, String(v.route), renderers.get(String(v.id)) ?? [])),
  ]);

  // The files that serve routes: each endpoint handler's, then the config's router files.
  const products = store.rows('product').map((p) => String(p.id)).sort();
  const owners = new Map<string, Set<string>>();
  for (const h of handlers) {
    const product = scopes.get(String(h.id));
    if (product) owners.set(String(h.file), new Set([...(owners.get(String(h.file)) ?? []), product]));
  }
  const routerFiles: string[] = [];
  for (const pattern of routers) {
    // Never a file of another product (a folder with its own lathe.config.json is that product's).
    for await (const file of glob(pattern, { cwd: root, exclude: (name) => ['node_modules', '.git'].includes(path.basename(name)) })) {
      if (!otherProductHolds(root, path.dirname(file))) routerFiles.push(file);
    }
  }
  const served: ServedFact[] = [];
  const seen = new Set<string>();
  for (const named of [...handlers.map((h) => String(h.file)), ...routerFiles.sort()]) {
    const got = await read(named);
    got.files.forEach((file, at) => {
      if (seen.has(file)) return;
      seen.add(file);
      const of = [...(owners.get(named) ?? owners.get(file) ?? products)].sort();
      for (const route of servedRoutes(got.texts[at])) for (const product of of) served.push({ ...route, product, file });
    });
  }
  return { facts, served };
}

/** Writes the route facts into their tables (ROUTE_FACT_TABLES_SQL, made first). */
export async function writeRouteFacts(connection: DuckDBConnection, { facts, served }: { facts: RouteFact[]; served: ServedFact[] }): Promise<void> {
  await connection.run(ROUTE_FACT_TABLES_SQL);
  const rows = async (table: string, values: (string | number | boolean | null)[][]) => {
    const appender = await connection.createAppender(table);
    for (const row of values) {
      for (const value of row) {
        if (value === null) appender.appendNull();
        else if (typeof value === 'boolean') appender.appendBoolean(value);
        else if (typeof value === 'number') appender.appendInteger(value);
        else appender.appendVarchar(value);
      }
      appender.endRow();
    }
    appender.closeSync();
  };
  await rows('route_facts', facts.map((f) => [f.record, f.kind, f.method, f.route, f.normal, f.files, f.found]));
  await rows('served_routes', served.map((s) => [s.product, s.file, s.line, s.method, s.route, s.normal]));
}
