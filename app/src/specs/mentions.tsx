import { useMemo } from 'react';
import type { SpecIndex, SpecRecord } from './data';
import { addressOf } from '../views/address';
import { Markdown, type ProseLinks } from './Markdown';

// A record's body with the IDs it cites as links (FORMAT.md section 11). The engine lists the
// existing records a body cites in `mentions` (missing before pass 5: treated as none), and warns
// with `unknown-id-in-prose` about a cited ID that is not a record; those show as broken links.

export const UNKNOWN_ID_CHECK = 'unknown-id-in-prose';
const ID_IN_MESSAGE = /[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+/g;

/** The links a record's prose gets: its mentions, with titles, and the unknown IDs its warnings name. */
export function proseLinks(index: SpecIndex, record: SpecRecord): ProseLinks {
  const titles = new Map<string, string>();
  for (const id of record.mentions) {
    const target = index.byId.get(id);
    if (target && id !== record.id) titles.set(id, target.title);
  }
  const broken = new Set<string>();
  for (const p of index.problemsFor.get(record.id) ?? []) {
    if (p.check !== UNKNOWN_ID_CHECK) continue;
    for (const [id] of p.message.matchAll(ID_IN_MESSAGE)) if (id !== record.id && !index.byId.has(id)) broken.add(id);
  }
  return { titles, broken, href: (id: string) => addressOf(id) };
}

export function RecordMarkdown({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const links = useMemo(() => proseLinks(index, record), [index, record]);
  return <Markdown source={record.body} links={links} />;
}
