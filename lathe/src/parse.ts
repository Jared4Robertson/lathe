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
