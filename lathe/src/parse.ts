// Turns one record file's text into its parts, or explains why it cannot.
import { parse as parseYaml } from 'yaml';

export interface ParsedRecord {
  id: string;
  kind: string;
  title: string;
  parent: string | null;
  fields: Record<string, string>;
  links: { relation: string; target: string }[];
  body: string;
}

export type ParseResult = { ok: true; record: ParsedRecord } | { ok: false; reason: string };

const HEADER = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const STRUCTURAL = new Set(['id', 'kind', 'title', 'parent', 'links']);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Parses a record file. A header value of null (an empty field) counts as absent,
// so the checks report it as missing rather than as a parse error.
export function parseRecordFile(text: string): ParseResult {
  // Allow an empty header: "---\n---\n".
  const match = HEADER.exec(text) ?? /^﻿?---[ \t]*\r?\n()---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { ok: false, reason: 'it has no YAML header between --- lines' };

  let header: unknown;
  try {
    header = parseYaml(match[1]) ?? {};
  } catch (error) {
    const detail = (error instanceof Error ? error.message.split('\n')[0] : String(error)).replace(/[\s:.]+$/, '');
    return { ok: false, reason: `its YAML header is not valid: ${detail}` };
  }
  if (!isPlainObject(header)) return { ok: false, reason: 'its YAML header is not a map of fields' };

  const fields: Record<string, string> = {};
  const structural: Record<string, string | null> = { id: null, kind: null, title: null, parent: null };
  for (const [name, value] of Object.entries(header)) {
    if (name === 'links' || value === null || value === undefined) continue;
    // Plain values are kept as text, so `score: 4` and `score: "4"` mean the same. Lists and maps are not plain values.
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      return { ok: false, reason: `field "${name}" is not a plain value (text, a number or true/false)` };
    }
    const text = String(value);
    if (STRUCTURAL.has(name)) structural[name] = text.trim();
    else fields[name] = text;
  }

  const links: ParsedRecord['links'] = [];
  const rawLinks = header.links;
  if (rawLinks !== null && rawLinks !== undefined) {
    if (!isPlainObject(rawLinks)) return { ok: false, reason: '"links" is not a map from relation to a list of IDs' };
    for (const [relation, targets] of Object.entries(rawLinks)) {
      if (targets === null) continue;
      if (!Array.isArray(targets) || !targets.every((t) => typeof t === 'string')) {
        return { ok: false, reason: `links.${relation} is not a list of IDs` };
      }
      for (const target of targets as string[]) links.push({ relation, target: target.trim() });
    }
  }

  return {
    ok: true,
    record: {
      id: structural.id ?? '',
      kind: structural.kind ?? '',
      title: structural.title ?? '',
      parent: structural.parent || null,
      fields,
      links,
      body: text.slice(match[0].length).trim(),
    },
  };
}

// An ID-shaped token: the ID format from FORMAT.md section 2, as a whole word. TL-LEND-DR05 is found in
// "TL-LEND-DR05." and "[TL-LEND-DR05](x.md)", but nothing is found in "TL-LEND-DR05a" or "tl-LEND-DR05".
const ID_TOKEN = /(?<![A-Za-z0-9_-])[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*(?![A-Za-z0-9_]|-[A-Za-z0-9])/g;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LONE_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;
// Marks a lone-ID code span's ID in the blanked text, so a reader can tell it came from code.
const CODE_MARK = '\u0001';

// Blanks out fenced code blocks and inline code spans, so that IDs in code are not read as citations,
// except a code span holding exactly one ID and nothing else (`TL-LEND-DR05`, `S2`): writers format IDs that way.
// The ID kept from such a span is wrapped in CODE_MARK.
function withoutCode(body: string): string {
  const kept: string[] = [];
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const open = FENCE.exec(line);
    if (fence === null) {
      if (open) fence = open[1];
      else kept.push(line);
      continue;
    }
    // A fence closes on a line holding only a run of the same character, at least as long as the opening one.
    if (open && open[1][0] === fence[0] && open[1].length >= fence.length && line.trim() === open[1]) fence = null;
    kept.push('');
  }
  // A code span opens with a run of backticks and closes with the next run of the same length.
  return kept.join('\n').replace(/(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)/g, (_span, _ticks, inner: string) =>
    LONE_ID.test(inner.trim()) ? ` ${CODE_MARK}${inner.trim()}${CODE_MARK} ` : ' ');
}

/** An ID-shaped token in a record body, and whether it was written as a code span holding only that ID. */
export interface ProseToken {
  token: string;
  inCode: boolean;
}

/** The ID-shaped tokens a record body has outside fenced code blocks and code spans (a span holding one lone ID counts), in order, repeats included. */
export function proseTokens(body: string): ProseToken[] {
  return [...withoutCode(body).matchAll(ID_TOKEN)].map((m) => ({
    token: m[0],
    inCode: m.input[m.index - 1] === CODE_MARK,
  }));
}

/** The ID-shaped tokens of proseTokens, without where they were written. */
export function idTokensInProse(body: string): string[] {
  return proseTokens(body).map((t) => t.token);
}

/** What an entity's body says under its `## Fields` heading (FORMAT.md section 17), before any judgment. */
export interface FieldsTable {
  /** Whether the body has a `## Fields` heading outside fenced code. */
  heading: boolean;
  /** The table's header cells, in order, or null when no table follows the heading. */
  columns: string[] | null;
  /** The table's data rows, each a list of cells, in table order. */
  rows: string[][];
}

/** The Fields table's columns, in order. */
export const FIELDS_COLUMNS = ['Field', 'Meaning', 'Kind of value', 'Example'];

const FIELDS_HEADING = /^ {0,3}##[ \t]+Fields[ \t]*#*[ \t]*$/i;
const ANY_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const TABLE_DELIMITER = /^\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?$/;

// Splits one Markdown table row into trimmed cells. A pipe escaped as \| or inside a code span stays in its cell.
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

const closesFence = (line: string, fence: string) => {
  const open = FENCE.exec(line);
  return open !== null && open[1][0] === fence[0] && open[1].length >= fence.length && line.trim() === open[1];
};

/**
 * Reads the first `## Fields` heading of a body outside fenced code, and the Markdown table that follows it
 * before any other heading: its header cells and data rows. Blank lines and prose may come between the
 * heading and the table.
 */
export function readFieldsTable(body: string): FieldsTable {
  const lines = body.split(/\r?\n/);
  let fence: string | null = null;
  let start = -1;
  for (let i = 0; i < lines.length && start < 0; i++) {
    if (fence !== null) {
      if (closesFence(lines[i], fence)) fence = null;
      continue;
    }
    const open = FENCE.exec(lines[i]);
    if (open) fence = open[1];
    else if (FIELDS_HEADING.test(lines[i])) start = i + 1;
  }
  if (start < 0) return { heading: false, columns: null, rows: [] };
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (ANY_HEADING.test(line) || FENCE.test(line)) break;
    if (!line.trim().startsWith('|') || !TABLE_DELIMITER.test((lines[i + 1] ?? '').trim())) continue;
    const rows: string[][] = [];
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) rows.push(tableCells(lines[j]));
    return { heading: true, columns: tableCells(line), rows };
  }
  return { heading: true, columns: null, rows: [] };
}

/** Whether a Fields table's header is Field, Meaning, Kind of value and Example, in that order, in any letter case. */
export const hasFieldsColumns = (columns: string[] | null): boolean =>
  columns !== null &&
  columns.length === FIELDS_COLUMNS.length &&
  columns.every((c, i) => c.toLowerCase() === FIELDS_COLUMNS[i].toLowerCase());
