import { useMemo } from 'react';
import type { SpecIndex } from './data';
import { addressOf } from '../views/address';
import { ID_TOKEN, Markdown, type ProseLinks } from './Markdown';

// A text field rendered as Markdown, with the record IDs it names turned into links: every
// ID-shaped token that is a record of the space, other than the record itself.

/** The links a text gets: each record it names, with its title. */
export function proseLinks(index: SpecIndex, source: string, self: string): ProseLinks {
  const titles = new Map<string, string>();
  for (const [id] of source.matchAll(ID_TOKEN)) {
    const target = index.byId.get(id);
    if (target && id !== self) titles.set(id, target.title);
  }
  return { titles, href: (id: string) => addressOf(id) };
}

/** One text field of a record, as Markdown with its record IDs linked. */
export function Prose({ index, source, self }: { index: SpecIndex; source: string; self: string }) {
  const links = useMemo(() => proseLinks(index, source, self), [index, source, self]);
  return <Markdown source={source} links={links} />;
}
