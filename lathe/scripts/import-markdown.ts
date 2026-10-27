// A one-time converter from the Markdown specs to the data files (database first, build step 3). It reads every
// record with the Markdown engine (loadWorkspace, which uses src/parse.ts), maps each body's text into its kind's
// typed fields and part rows, and writes everything through the store's command layer: Lathe's spec to data/ at the
// repo root, the Tool Library's to examples/tool-library/data/, Lathe's built-in checks to lathe/data/check.jsonl
// and the repo's own checks to Lathe's data/. Then it opens each data folder afresh and proves the round trip: the
// same records, kinds, parents and links as the Markdown load, every Fields, Shapes and Settings table row and use
// case step placed, and every word of every body kept somewhere in the record's fields or parts.
//
//   node lathe/scripts/import-markdown.ts [--root <repo>] [--check]
//
// --check writes nothing: it converts into a temporary folder and runs the round trip there. The script is deleted
// with the Markdown reader in the engine cutover.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHECKS_DIR, loadWorkspace, openStore, parseCheckHeader, PACKAGE_DIR, type Command, type Row, type SchemaDescription, type SpecLink, type SpecRecord, type Store } from '../src/index.ts';

const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const ROOT = path.resolve(option('--root') ?? path.join(PACKAGE_DIR, '..'));
const CHECK_ONLY = args.includes('--check');

/** Where each product's data folder is, from the repo root. */
const PRODUCT_FOLDERS: Record<string, string> = { LA: 'data', TL: 'examples/tool-library/data' };
/** The repo's own checks folder (lathe.config.json's checks) and the product they belong to. */
const REPO_CHECKS = { dir: 'lathe-checks', product: 'LA' };
/** Lathe's built-in checks' data folder, inside the package. */
const PACKAGE_DATA = path.join(PACKAGE_DIR, 'data');

// ---------------------------------------------------------------------------------------------------------------
// Bodies: blocks and sections.

type BlockType = 'heading' | 'paragraph' | 'list' | 'olist' | 'table' | 'code' | 'quote';
interface Block {
  type: BlockType;
  text: string;
}
interface Section {
  heading: string | null;
  blocks: Block[];
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t#]*$/;

function classify(text: string): BlockType {
  const first = text.split('\n')[0];
  if (HEADING.test(first)) return 'heading';
  if (FENCE.test(first)) return 'code';
  if (/^\s*\|/.test(first)) return 'table';
  if (/^\s*\d+[.)][ \t]/.test(first)) return 'olist';
  if (/^\s*[-*+][ \t]/.test(first)) return 'list';
  if (/^\s*>/.test(first)) return 'quote';
  return 'paragraph';
}

/** A body's blocks: runs of lines between blank lines, a fenced code block whole, a heading on its own. */
function blocksOf(body: string): Block[] {
  const blocks: Block[] = [];
  let lines: string[] = [];
  const flush = () => {
    if (lines.length) blocks.push({ type: classify(lines.join('\n')), text: lines.join('\n') });
    lines = [];
  };
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    if (fence !== null) {
      lines.push(line);
      const close = FENCE.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length && line.trim() === close[1]) {
        fence = null;
        flush();
      }
      continue;
    }
    const open = FENCE.exec(line);
    if (open) {
      flush();
      fence = open[1];
      lines.push(line);
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (HEADING.test(line)) {
      flush();
      lines.push(line);
      flush();
      continue;
    }
    lines.push(line);
  }
  flush();
  return blocks;
}

function sectionsOf(body: string): Section[] {
  const sections: Section[] = [{ heading: null, blocks: [] }];
  for (const block of blocksOf(body)) {
    if (block.type === 'heading') sections.push({ heading: HEADING.exec(block.text)![2].trim(), blocks: [] });
    else sections.at(-1)!.blocks.push(block);
  }
  return sections;
}

const joinBlocks = (blocks: Block[]) => blocks.map((b) => b.text).join('\n\n');
const sectionText = (s: Section) => (s.heading === null ? joinBlocks(s.blocks) : [`## ${s.heading}`, ...s.blocks.map((b) => b.text)].join('\n\n'));
const sectionsText = (sections: Section[]) => sections.filter((s) => s.heading !== null || s.blocks.length).map(sectionText).join('\n\n');

// Splits one Markdown table row into trimmed cells; a pipe escaped as \| or inside a code span stays in its cell.
function tableCells(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells: string[] = [];
  let cell = '';
  let ticks = 0;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '\\' && row[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (c === '`') {
      let run = 1;
      while (row[i + run] === '`') run++;
      if (ticks === 0) ticks = run;
      else if (ticks === run) ticks = 0;
      cell += '`'.repeat(run);
      i += run - 1;
    } else if (c === '|' && ticks === 0) {
      cells.push(cell.trim());
      cell = '';
    } else cell += c;
  }
  cells.push(cell.trim());
  return cells;
}

/** A table block's header cells and data rows. */
function readTable(block: Block): { columns: string[]; rows: string[][] } {
  const lines = block.text.split('\n');
  return { columns: tableCells(lines[0]), rows: lines.slice(2).map(tableCells) };
}

/** An ordered list block's items, each with its continuation lines joined by spaces. */
function listItems(block: Block): string[] {
  const items: string[] = [];
  for (const line of block.text.split('\n')) {
    const item = /^\s*\d+[.)][ \t]+(.*)$/.exec(line);
    if (item) items.push(item[1].trim());
    else items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
}

const firstParagraph = (blocks: Block[]) => {
  const at = blocks.findIndex((b) => b.type === 'paragraph');
  return at === 0 ? { first: blocks[0].text, rest: blocks.slice(1) } : { first: undefined, rest: blocks };
};

// ---------------------------------------------------------------------------------------------------------------
// Decisions: every body whose text needed a choice, for the report.

interface Decision {
  kind: string;
  id: string;
  what: string;
}
const decisions: Decision[] = [];
const decide = (r: SpecRecord, what: string) => decisions.push({ kind: r.kind, id: r.id, what });

// ---------------------------------------------------------------------------------------------------------------
// Records to rows.

interface Converted {
  table: string;
  row: Row;
  parts: { table: string; row: Row }[];
  /** Words the body had that its fields do not hold on purpose: table headings and the like. */
  structural: string[];
}

const text = (value: string | undefined) => (value === undefined || value.trim() === '' ? undefined : value.trim());

function put(row: Row, column: string, value: string | number | boolean | undefined) {
  if (value === undefined || value === '') return;
  row[column] = value;
}

/** A description and notes from a body: the first paragraph, then everything after it. */
function describe(r: SpecRecord, row: Row, sections: Section[], hasNotes: boolean, descriptionColumn = 'description') {
  const [intro, ...rest] = sections;
  const { first, rest: after } = firstParagraph(intro.blocks);
  const remaining = sectionsText([{ heading: null, blocks: after }, ...rest]);
  if (hasNotes) {
    put(row, descriptionColumn, text(first));
    put(row, 'notes', text(remaining));
    if (first === undefined && remaining) decide(r, `the body starts with no paragraph, so ${descriptionColumn} is empty and the whole body is notes`);
  } else {
    const whole = sectionsText(sections);
    put(row, descriptionColumn, text(whole));
    if (remaining) decide(r, `${descriptionColumn} holds the whole body (${countBlocks(sections)} blocks), as the kind has no notes`);
  }
}
const countBlocks = (sections: Section[]) => sections.reduce((n, s) => n + s.blocks.length + (s.heading === null ? 0 : 1), 0);

// Where a test's sentence turns from what it does to what it expects: "... and expects ...", "...; then checks ...".
const EXPECTS = /(?:[,;:]\s+|\s+)(?:and\s+|then\s+)*(expects|checks)\b/gi;
// A test's sentence that starts with what it does, in the third person, such as "Lends three tools ...".
const ACTION_FIRST = /^[A-Z][a-z]+s\b/;

/** The first match of a global pattern that lies outside quotes and code spans. */
function firstOutside(pattern: RegExp, value: string): RegExpExecArray | undefined {
  for (const m of value.matchAll(pattern)) {
    const before = value.slice(0, m.index);
    if ((before.match(/"/g)?.length ?? 0) % 2 === 0 && (before.match(/`/g)?.length ?? 0) % 2 === 0) return m as RegExpExecArray;
  }
  return undefined;
}

/** One paragraph of a test, split into what it does (when) and what it expects (then). */
function splitTestParagraph(paragraph: string, structural: string[]): { when?: string; then?: string; how: 'split' | 'when' | 'then' } {
  if (/^(expects|checks)\b/i.test(paragraph)) return { then: paragraph, how: 'split' };
  const capital = (s: string) => s[0].toUpperCase() + s.slice(1);
  const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
  const at = firstOutside(EXPECTS, paragraph);
  if (at) {
    structural.push(...words(at[0].slice(0, -at[1].length)));
    return { when: sentence(paragraph.slice(0, at.index)), then: capital(paragraph.slice(at.index + at[0].length - at[1].length)), how: 'split' };
  }
  // "Lends three tools to one member; the fourth borrow is refused ...": what it does, then the outcome.
  const outcome = ACTION_FIRST.test(paragraph) ? firstOutside(/[;:]\s+(?!then\b)/g, paragraph) : undefined;
  if (outcome) return { when: sentence(paragraph.slice(0, outcome.index)), then: capital(paragraph.slice(outcome.index + outcome[0].length)), how: 'split' };
  return ACTION_FIRST.test(paragraph) ? { when: paragraph, how: 'when' } : { then: paragraph, how: 'then' };
}

/** The test's Given, When and Then (and notes) from its body. */
function testText(r: SpecRecord, row: Row, sections: Section[], structural: string[]) {
  if (sections.length > 1) throw new Error(`${r.id}: a test body with headings needs a rule of its own`);
  const blocks = sections[0].blocks;
  const steps = blocks.findIndex((b) => b.type === 'olist');
  if (steps >= 0) {
    // A procedure: the numbered steps are what it does, a paragraph saying when it passes is what it expects, and
    // the text before the steps, such as why it is manual and when to run it, is notes.
    const passes = blocks.findIndex((b, i) => i > steps && b.type === 'paragraph' && /^It passes when\b/.test(b.text));
    const after = blocks.slice(steps + 1).filter((_, i) => steps + 1 + i !== passes);
    put(row, 'notes', text(joinBlocks(blocks.slice(0, steps))));
    put(row, 'when', joinBlocks([blocks[steps], ...after]));
    if (passes >= 0) put(row, 'then', blocks[passes].text);
    decide(r, `a procedure: the text before its steps is notes, the steps${after.length ? ' and what follows them' : ''} \`when\`${passes >= 0 ? ', and its pass condition `then`' : ''}`);
    return;
  }
  if (blocks.some((b) => b.type !== 'paragraph')) throw new Error(`${r.id}: a test body with ${blocks.map((b) => b.type).join(', ')} needs a rule of its own`);
  const [first, ...rest] = blocks.map((b) => b.text);
  const split = splitTestParagraph(first, structural);
  put(row, 'when', split.when);
  // Later paragraphs that say what it expects add to then; any other is notes.
  const expects = rest.filter((p) => /\bexpects?\b/i.test(p));
  const others = rest.filter((p) => !expects.includes(p));
  put(row, 'then', text([split.then ?? '', ...expects].filter(Boolean).join('\n\n')));
  put(row, 'notes', text(others.join('\n\n')));
  if (split.how !== 'split') decide(r, `the body has no turn from what the test does to what it expects, so it is all \`${split.how}\` (${split.how === 'when' ? 'it starts with an action' : 'it states an outcome'})`);
  if (others.length) decide(r, 'a paragraph after the first says neither what the test does nor what it expects, so it is notes');
  if (expects.length) decide(r, 'a later paragraph says what the test expects, so it joins `then`');
}

interface PatternInfo {
  settings: string[];
}

function convert(r: SpecRecord, schema: SchemaDescription, byId: Map<string, SpecRecord>, patterns: Map<string, PatternInfo>, links: SpecLink[]): Converted {
  const kind = schema.kinds[r.kind];
  if (!kind) throw new Error(`${r.path}: kind ${r.kind} has no table`);
  const table = schema.tables[r.kind];
  const has = (column: string) => table.columns.some((c) => c.name === column);
  const row: Row = { id: r.id, title: r.title };
  const parts: Converted['parts'] = [];
  const structural: string[] = [];
  const fields = { ...r.fields };
  const take = (name: string) => {
    const value = fields[name];
    delete fields[name];
    return value;
  };

  // Parents: the nearest parent's column, then the columns the table requires or ties to it with one foreign key,
  // from the record's ancestry.
  if (r.parent) {
    const parent = byId.get(r.parent)!;
    const own = kind.parents.find((p) => p.kind === parent.kind);
    if (!own) throw new Error(`${r.id}: a ${r.kind} cannot sit under a ${parent.kind}`);
    row[own.column] = parent.id;
    const ancestors: SpecRecord[] = [];
    for (let a = byId.get(parent.parent ?? ''); a; a = a.parent ? byId.get(a.parent) : undefined) ancestors.push(a);
    for (const p of kind.parents) {
      if (p.column === own.column) continue;
      const required = table.columns.find((c) => c.name === p.column)?.required;
      const tied = table.foreignKeys.some((fk) => fk.columns.includes(p.column) && fk.columns.includes(own.column));
      if (!required && !tied) continue;
      const found = ancestors.find((a) => a.kind === p.kind);
      if (found) row[p.column] = found.id;
    }
  }

  const sections = sectionsOf(r.body);
  const notes = has('notes');

  // Header fields, renamed.
  const position = take('order');
  if (position !== undefined) row.position = Number(position);
  const group = take('group');
  if (group !== undefined) row.group_name = group.trim();

  switch (r.kind) {
    case 'product': {
      describe(r, row, sections, true);
      put(row, 'icon', text(take('icon')));
      put(row, 'color', text(take('color')));
      const actors = take('actors');
      for (const name of (actors ?? '').split(/[\s,]+/).filter(Boolean)) parts.push({ table: 'role', row: { product_id: r.id, name } });
      break;
    }
    case 'aggregate': {
      const [intro, ...rest] = sections;
      const identityAt = intro.blocks.findIndex((b) => /^\*\*Business identity:\*\*/.test(b.text));
      if (identityAt >= 0) {
        put(row, 'identity', intro.blocks[identityAt].text.replace(/^\*\*Business identity:\*\*\s*/, '').replace(/\.$/, ''));
        structural.push('Business', 'identity');
        intro.blocks.splice(identityAt, 1);
      }
      describe(r, row, [intro, ...rest], true);
      break;
    }
    case 'entity':
    case 'domain_event': {
      put(row, 'role', text(take('role')));
      const partTable = r.kind === 'entity' ? 'entity_field' : 'event_field';
      const owner = r.kind === 'entity' ? 'entity_id' : 'domain_event_id';
      const at = sections.findIndex((s) => s.heading?.toLowerCase() === 'fields');
      if (at >= 0) {
        const fieldsSection = sections[at];
        const tableAt = fieldsSection.blocks.findIndex((b) => b.type === 'table');
        if (tableAt >= 0) {
          const { columns, rows } = readTable(fieldsSection.blocks[tableAt]);
          structural.push('Fields', ...columns.flatMap(words));
          rows.forEach((cells, i) => {
            const part: Row = { [owner]: r.id, position: i + 1, name: cells[0], meaning: cells[1], type: cells[2] };
            put(part, 'example', text(cells[3]));
            parts.push({ table: partTable, row: part });
          });
          fieldsSection.blocks.splice(tableAt, 1);
        }
        if (fieldsSection.blocks.length) {
          decide(r, `the Fields section's text around its table joins the description`);
          sections[0].blocks.push(...fieldsSection.blocks);
        }
        sections.splice(at, 1);
      }
      describe(r, row, sections, false);
      break;
    }
    case 'api': {
      const at = sections.findIndex((s) => s.heading?.toLowerCase() === 'shapes');
      if (at >= 0) {
        const shapes = sections[at];
        const tableAt = shapes.blocks.findIndex((b) => b.type === 'table');
        if (tableAt >= 0) {
          const { columns, rows } = readTable(shapes.blocks[tableAt]);
          structural.push('Shapes', ...columns.flatMap(words));
          rows.forEach((cells, i) => parts.push({ table: 'api_shape', row: { api_id: r.id, position: i + 1, name: cells[0], meaning: cells[1], fields: cells[2] } }));
          shapes.blocks.splice(tableAt, 1);
        }
        const boilerplate = shapes.blocks.filter((b) => /^The request and response shapes its endpoints share/.test(b.text));
        for (const b of boilerplate) {
          structural.push(...words(b.text));
          decide(r, `dropped the Shapes table's lead-in "${b.text}": the api_shape table's own description says it`);
        }
        const other = shapes.blocks.filter((b) => !boilerplate.includes(b));
        if (other.length) {
          decide(r, `the Shapes section's other text joins the description`);
          sections[0].blocks.push(...other);
        }
        sections.splice(at, 1);
      }
      describe(r, row, sections, false);
      break;
    }
    case 'use_case': {
      const actors = (take('actor') ?? '').split(',').map((a) => a.trim()).filter(Boolean);
      actors.forEach((role_name, i) => parts.push({ table: 'use_case_actor', row: { use_case_id: r.id, position: i + 1, role_name } }));
      const [intro, ...rest] = sections;
      const { first, rest: after } = firstParagraph(intro.blocks);
      put(row, 'goal', text(first));
      // The first run of numbered lists is the main course.
      const stepsAt = after.findIndex((b) => b.type === 'olist');
      if (stepsAt >= 0) {
        let end = stepsAt;
        while (end < after.length && after[end].type === 'olist') end++;
        const steps = after.slice(stepsAt, end).flatMap(listItems);
        steps.forEach((description, i) => parts.push({ table: 'use_case_step', row: { use_case_id: r.id, position: i + 1, description } }));
        after.splice(stepsAt, end - stepsAt);
      }
      put(row, 'notes', text(sectionsText([{ heading: null, blocks: after }, ...rest])));
      if (first === undefined) decide(r, 'the body starts with no paragraph, so the goal is empty');
      break;
    }
    case 'pattern': {
      const settings = (take('settings') ?? '').split(/[\s,]+/).filter(Boolean);
      const meanings = new Map<string, string>();
      const at = sections.findIndex((s) => s.heading?.toLowerCase() === 'settings');
      if (at >= 0) {
        const s = sections[at];
        const tableAt = s.blocks.findIndex((b) => b.type === 'table');
        if (tableAt >= 0) {
          const { columns, rows } = readTable(s.blocks[tableAt]);
          structural.push('Settings', ...columns.flatMap(words));
          for (const cells of rows) meanings.set(cells[0].replace(/`/g, '').trim(), cells[1]);
          structural.push(...rows.flatMap((cells) => words(cells[0])));
          s.blocks.splice(tableAt, 1);
          if (!s.blocks.length) sections.splice(at, 1);
          else decide(r, 'the Settings section keeps its other text in notes');
        }
      }
      for (const name of meanings.keys()) if (!settings.includes(name)) throw new Error(`${r.id}: setting ${name} is in the Settings table but not the header`);
      settings.forEach((name, i) => {
        const part: Row = { pattern_id: r.id, position: i + 1, name };
        put(part, 'meaning', text(meanings.get(name)));
        parts.push({ table: 'pattern_setting', row: part });
      });
      patterns.set(r.id, { settings });
      describe(r, row, sections, true);
      break;
    }
    case 'pattern_rule': {
      put(row, 'setting', text(take('setting')));
      const appliesWhen = take('applies_when');
      if (appliesWhen !== undefined) {
        const m = /^\s*([a-z][a-z0-9_]*)\s+is\s+(not\s+)?(.+?)\s*$/i.exec(appliesWhen);
        if (!m) throw new Error(`${r.id}: applies_when "${appliesWhen}" is not "<setting> is [not] <value>"`);
        row.applies_when_setting = m[1];
        row.applies_when_negated = Boolean(m[2]);
        row.applies_when_value = m[3];
        structural.push('is', ...(m[2] ? ['not'] : []));
      }
      statementAndNotes(r, row, sections, true);
      break;
    }
    case 'requirement':
    case 'domain_rule':
    case 'interaction_requirement':
    case 'standard_rule':
      statementAndNotes(r, row, sections, notes);
      break;
    case 'endpoint':
      put(row, 'method', text(take('method')));
      put(row, 'route', text(take('route')));
      describe(r, row, sections, true);
      break;
    case 'view':
      put(row, 'route', text(take('route')));
      describe(r, row, sections, true);
      break;
    case 'component':
      put(row, 'component_type', text(take('component_type'))?.toLowerCase().replace(/\s+/g, '-'));
      put(row, 'file', text(take('file')));
      describe(r, row, sections, notes);
      break;
    case 'test': {
      put(row, 'test_type', text(take('test_type')));
      put(row, 'state', text(take('state')) ?? 'automated');
      put(row, 'file', text(take('run_by')));
      put(row, 'key', text(take('key')));
      put(row, 'key_file', text(take('key_file')));
      testText(r, row, sections, structural);
      break;
    }
    case 'flow_step':
    case 'design_step':
      put(row, 'path', text(take('path')) ?? 'main');
      put(row, 'transaction_name', text(take('transaction')));
      put(row, 'locks', text(take('locks')));
      put(row, 'statements', text(take('statements')));
      describe(r, row, sections, notes);
      break;
    case 'integration':
      put(row, 'system', text(take('system')));
      describe(r, row, sections, notes);
      break;
    case 'question':
      put(row, 'owner', text(take('owner')));
      describe(r, row, sections, notes);
      break;
    default:
      describe(r, row, sections, notes);
  }

  // A follower's setting values: header fields named for a setting of a pattern it follows.
  for (const link of links.filter((l) => l.source === r.id && l.relation === 'follows')) {
    const pattern = patterns.get(link.target);
    if (!pattern) throw new Error(`${r.id} follows ${link.target}, which is read after it`);
    for (const setting of pattern.settings) {
      const value = take(setting);
      if (value === undefined) continue;
      const na = /^\s*Not applicable:\s*(.*)$/is.exec(value);
      const part: Row = { follower_id: r.id, pattern_id: link.target, setting };
      if (na) {
        part.not_applicable = na[1].trim();
        structural.push('Not', 'applicable');
      } else part.value = value.trim();
      parts.push({ table: 'setting_value', row: part });
    }
  }

  const unknown = Object.keys(fields);
  if (unknown.length) throw new Error(`${r.id}: header fields ${unknown.join(', ')} have no column`);
  return { table: r.kind, row, parts, structural };
}

/** A statement from the body: the first paragraph and the rest as notes where the kind has notes, else the whole body. */
function statementAndNotes(r: SpecRecord, row: Row, sections: Section[], hasNotes: boolean) {
  const [intro, ...rest] = sections;
  const { first, rest: after } = firstParagraph(intro.blocks);
  const remaining = sectionsText([{ heading: null, blocks: after }, ...rest]);
  if (hasNotes && first !== undefined) {
    row.statement = first;
    put(row, 'notes', text(remaining));
    return;
  }
  row.statement = sectionsText(sections);
  if (remaining) decide(r, `the statement holds the whole body (${countBlocks(sections)} blocks), as the kind has no notes`);
}

// ---------------------------------------------------------------------------------------------------------------
// The word check: every word of a body is in its record's fields or parts, or is structure the rows replace.

function words(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function missingWords(r: SpecRecord, converted: Converted): string[] {
  const held = new Map<string, number>();
  const add = (w: string) => held.set(w, (held.get(w) ?? 0) + 1);
  const values = [converted.row, ...converted.parts.map((p) => p.row)].flatMap((row) => Object.values(row).map(String));
  for (const v of values) for (const w of words(v)) add(w);
  for (const w of converted.structural.flatMap(words)) add(w);
  const missing: string[] = [];
  for (const w of words([r.body, ...Object.values(r.fields)].join(' '))) {
    const n = held.get(w) ?? 0;
    if (n === 0) missing.push(w);
    else held.set(w, n - 1);
  }
  return missing;
}

// ---------------------------------------------------------------------------------------------------------------
// Checks to rows.

function checkRows(dir: string, productId: string | null): Row[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  return files.map((file, i) => {
    const sql = readFileSync(path.join(dir, file), 'utf8');
    const header = parseCheckHeader(sql);
    if (header.missing.length) throw new Error(`${file}: the header lacks ${header.missing.join(', ')}`);
    const lines = sql.split(/\r?\n/);
    const start = lines.findIndex((l) => !l.startsWith('--'));
    const query = lines.slice(start).join('\n').trim();
    const row: Row = {
      name: file.replace(/\.sql$/, '').replace(/^\d+-/, ''),
      position: i + 1,
      severity: header.severities.length === 2 ? 'error_or_warning' : header.severities[0],
      summary: header.summary,
      // The comment's line breaks only wrapped the text: each paragraph becomes one line, list items kept.
      explanation: header.explanation
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\n(?!\s*(?:[-*+]|\d+[.)])\s)/g, ' '))
        .join('\n\n'),
      query,
    };
    if (productId) row.product_id = productId;
    if (header.kinds.length) row.kinds = header.kinds;
    return row;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Writing and the round trip.

async function writeFolder(folder: string, commands: Command[]): Promise<void> {
  if (existsSync(folder)) for (const f of readdirSync(folder).filter((f) => f.endsWith('.jsonl'))) rmSync(path.join(folder, f));
  mkdirSync(folder, { recursive: true });
  const store = await openStore(ROOT, { dataDir: folder });
  try {
    await store.apply(commands);
  } finally {
    await store.close();
  }
}

interface Expected {
  records: SpecRecord[];
  links: SpecLink[];
  parts: Map<string, number>;
  checks: number;
}

async function roundTrip(name: string, folder: string, expected: Expected): Promise<string[]> {
  const failures: string[] = [];
  let store: Store;
  try {
    store = await openStore(ROOT, { dataDir: folder });
  } catch (error) {
    return [`${name}: the data folder does not load: ${(error as Error).message}`];
  }
  try {
    const records = await store.query<{ id: string; kind: string; parent_id: string | null }>('SELECT id, kind, parent_id FROM record_parent');
    const links = await store.query<{ relation: string; source_id: string; target_id: string }>('SELECT relation, source_id, target_id FROM link');
    const mdRecords = new Set(expected.records.map((r) => `${r.id} ${r.kind} ${r.parent ?? '-'}`));
    const dbRecords = new Set(records.map((r) => `${r.id} ${r.kind} ${r.parent_id ?? '-'}`));
    const mdLinks = new Set(expected.links.map((l) => `${l.source} ${l.relation} ${l.target}`));
    const dbLinks = new Set(links.map((l) => `${l.source_id} ${l.relation} ${l.target_id}`));
    const compare = (what: string, md: Set<string>, db: Set<string>) => {
      if (md.size !== db.size) failures.push(`${name}: ${md.size} ${what} in Markdown, ${db.size} in data`);
      for (const k of md) if (!db.has(k)) failures.push(`${name}: ${what} ${k} is in Markdown, not in data`);
      for (const k of db) if (!md.has(k)) failures.push(`${name}: ${what} ${k} is in data, not in Markdown`);
    };
    compare('records (id kind parent)', mdRecords, dbRecords);
    compare('links', mdLinks, dbLinks);
    for (const [table, count] of expected.parts) {
      const rows = store.rows(table).length;
      if (rows !== count) failures.push(`${name}: ${count} ${table} rows expected, ${rows} loaded`);
    }
    if (store.rows('check').length !== expected.checks) failures.push(`${name}: ${expected.checks} checks expected, ${store.rows('check').length} loaded`);
  } finally {
    await store.close();
  }
  return failures;
}

function countsOf(folder: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of readdirSync(folder).filter((f) => f.endsWith('.jsonl')).sort()) {
    counts[f.replace(/\.jsonl$/, '')] = readFileSync(path.join(folder, f), 'utf8').split('\n').filter(Boolean).length;
  }
  return counts;
}

// ---------------------------------------------------------------------------------------------------------------
// The run.

const workspace = await loadWorkspace(ROOT);
const errors = workspace.problems.filter((p) => p.severity === 'error');
if (errors.length) throw new Error(`The Markdown load has ${errors.length} errors; fix them first:\n${errors.map((p) => p.message).join('\n')}`);
const byId = new Map(workspace.records.map((r) => [r.id, r]));

// The schema, from a store on an empty folder.
const scratch = mkdtempSync(path.join(tmpdir(), 'lathe-import-'));
const schemaStore = await openStore(ROOT, { dataDir: path.join(scratch, 'empty') });
const schema = schemaStore.schema;
await schemaStore.close();

const target = (folder: string) => (CHECK_ONLY ? path.join(scratch, folder) : path.join(ROOT, folder));
const failures: string[] = [];
const report: { name: string; folder: string; counts: Record<string, number> }[] = [];

// Patterns first, so a follower finds its pattern's settings.
const order = (r: SpecRecord) => (r.kind === 'pattern' ? 0 : 1);
for (const [productId, folder] of Object.entries(PRODUCT_FOLDERS)) {
  const records = workspace.records.filter((r) => r.product === productId).sort((a, b) => order(a) - order(b) || a.path.localeCompare(b.path));
  const ids = new Set(records.map((r) => r.id));
  const links = workspace.links.filter((l) => ids.has(l.source));
  const patterns = new Map<string, PatternInfo>();
  const commands: Command[] = [];
  const parts = new Map<string, number>();
  const linkCommands: Command[] = [];
  const partCommands: Command[] = [];
  for (const r of records) {
    const converted = convert(r, schema, byId, patterns, links);
    commands.push({ op: 'add', table: converted.table, row: converted.row });
    for (const p of converted.parts) {
      (p.table === 'setting_value' ? linkCommands : partCommands).push({ op: 'add', table: p.table, row: p.row });
      parts.set(p.table, (parts.get(p.table) ?? 0) + 1);
    }
    const missing = missingWords(r, converted);
    if (missing.length) failures.push(`${productId}: ${r.id} (${r.path}) loses the words ${missing.join(', ')}`);
  }
  // Markdown entity and event Fields tables, read by the engine, against the part rows.
  const mdFields = (kind: string) => records.filter((r) => r.kind === kind).reduce((n, r) => n + (r.entityFields?.length ?? 0), 0);
  for (const [kind, table] of [['entity', 'entity_field'], ['domain_event', 'event_field']] as const) {
    if (mdFields(kind) !== (parts.get(table) ?? 0)) failures.push(`${productId}: the engine reads ${mdFields(kind)} ${kind} fields, the import made ${parts.get(table) ?? 0} ${table} rows`);
  }
  for (const l of links) linkCommands.unshift({ op: 'link', relation: l.relation, source: l.source, target: l.target });
  const checks = productId === REPO_CHECKS.product ? checkRows(path.join(ROOT, REPO_CHECKS.dir), productId) : [];
  for (const row of checks) commands.push({ op: 'add', table: 'check', row });
  const dataFolder = target(folder);
  await writeFolder(dataFolder, [...commands, ...partCommands, ...linkCommands]);
  failures.push(...(await roundTrip(productId, dataFolder, { records, links, parts, checks: checks.length })));
  report.push({ name: productId, folder, counts: countsOf(dataFolder) });
}

// Lathe's built-in checks, in the package's own data folder.
const latheChecks = checkRows(CHECKS_DIR, null);
const packageFolder = CHECK_ONLY ? path.join(scratch, 'lathe-data') : PACKAGE_DATA;
await writeFolder(packageFolder, latheChecks.map((row) => ({ op: 'add', table: 'check', row })));
failures.push(...(await roundTrip('Lathe checks', packageFolder, { records: [], links: [], parts: new Map(), checks: latheChecks.length })));
report.push({ name: 'Lathe checks', folder: path.relative(ROOT, PACKAGE_DATA), counts: countsOf(packageFolder) });

rmSync(scratch, { recursive: true, force: true });

for (const { name, folder, counts } of report) {
  console.log(`\n${name}: ${folder}${CHECK_ONLY ? ' (checked in a temporary folder, nothing written)' : ''}`);
  for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(24)} ${n}`);
}
const md = Object.fromEntries(Object.keys(PRODUCT_FOLDERS).map((p) => [p, workspace.records.filter((r) => r.product === p).length]));
console.log(`\nMarkdown records: ${Object.entries(md).map(([p, n]) => `${p} ${n}`).join(', ')}; links: ${workspace.links.length}`);
console.log(`\nDecisions (${decisions.length}):`);
const grouped = new Map<string, Decision[]>();
for (const d of decisions) grouped.set(`${d.kind}: ${d.what.replace(/\(\d+ blocks\)|of \d+ blocks/, '(n blocks)')}`, [...(grouped.get(`${d.kind}: ${d.what.replace(/\(\d+ blocks\)|of \d+ blocks/, '(n blocks)')}`) ?? []), d]);
for (const [what, list] of grouped) console.log(`  ${what} [${list.length}]: ${list.map((d) => d.id).join(' ')}`);
if (failures.length) {
  console.error(`\nRound trip FAILED (${failures.length}):\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('\nRound trip passed: every product has the same records, parents and links in Markdown and data, every table row and step placed, and every body word kept.');
