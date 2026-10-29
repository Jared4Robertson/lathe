import type { ReactNode } from 'react';
import { LongList } from '../components/LongList';
import { Refusal, problemText } from '../edit/fields';
import type { SpecIndex } from '../specs/data';
import { Markdown } from '../specs/Markdown';
import { Prose } from '../specs/mentions';
import { RecordRowBody, Section, recordText } from '../specs/parts';
import type { Read } from './read';

// The pieces an aggregate's page draws its records with (LA-PAT-RECORD-PAGE): a text read as Markdown under its
// heading or as the lead, short facts, rows that each lead to one record, a test's scenario and the data sets it starts
// from, the wiki card's summary, and what the page shows while its read is under way or refused. They know no kind:
// the page says which text, which facts and which records.

/** A text of the record, read as Markdown with the IDs it names as links, under its heading or as the page's lead. */
export function Text({ index, id, source, title, field }: { index: SpecIndex; id: string; source: string | undefined; title?: string; field: string }) {
  if (!source?.trim()) return null;
  const prose = <Prose index={index} source={source} self={id} />;
  return title ? <Section title={title} className={`record-${field}`}>{prose}</Section> : <div className="record-lead" data-field={field}>{prose}</div>;
}

/** One short fact of a record: its label and its value. */
export interface Fact {
  label: string;
  value: ReactNode;
}

/** Short facts of the record, as a definition list. */
export function Facts({ facts }: { facts: readonly Fact[] }) {
  if (facts.length === 0) return null;
  return <dl className="fields record-facts">{facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>;
}

/** Rows that each lead to one record, in the order given: its row in the shell's look (link, fields, test state, gaps, problems). */
export function Rows({ index, ids, label }: { index: SpecIndex; ids: readonly string[]; label: string }) {
  const records = ids.flatMap((id) => index.byId.get(id) ?? []);
  return (
    <LongList label={label} className="record-list" items={records} itemKey={(r) => r.id} searchText={recordText}
      render={(r) => <RecordRowBody index={index} record={r} />} />
  );
}

/** A section of rows, titled with its count, or a hint when there are none. */
export function RowsSection({ index, title, ids, label, empty, className }: { index: SpecIndex; title: string; ids: readonly string[]; label: string; empty: string; className?: string }) {
  return (
    <Section title={title} count={ids.length} className={className}>
      {ids.length === 0 ? <p className="hint">{empty}</p> : <Rows index={index} ids={ids} label={label} />}
    </Section>
  );
}

/** A test's scenario as the data holds it (a test loaded from a file may still lack a part), its notes and what it starts from. */
export function TestScenario({ index, id, when, then, notes, startsFrom }: { index: SpecIndex; id: string; when?: string; then?: string; notes?: string; startsFrom: readonly string[] }) {
  return (
    <>
      {(when || then) && (
        <dl className="scenario" aria-label="Scenario">
          {when && <div data-field="when"><dt>When</dt><dd><Prose index={index} source={when} self={id} /></dd></div>}
          {then && <div data-field="then"><dt>Then</dt><dd><Prose index={index} source={then} self={id} /></dd></div>}
        </dl>
      )}
      <Text index={index} id={id} source={notes} title="Notes" field="notes" />
      {startsFrom.length > 0 && <Section title="Starts from" count={startsFrom.length} level={3}><Rows index={index} ids={startsFrom} label={`Test data sets ${id} starts from`} /></Section>}
    </>
  );
}

/** The record's summary in the wiki card: its lead text and a few key facts. */
export function Summary({ lead, facts }: { lead?: string; facts: readonly Fact[] }) {
  return (
    <>
      {lead && <div className="wiki-panel-lead"><Markdown source={lead} /></div>}
      <Facts facts={facts} />
    </>
  );
}

/**
 * What an aggregate's page shows until its read answers for the record: no record, the read's refusal with its
 * reasons, or that it is reading (also while the answer is of data from before the record was added). Undefined once
 * `answer` holds the record, when the page draws it.
 */
export function readState<T>(index: SpecIndex, id: string, read: Read<T>, holds: (answer: T) => boolean, summary: boolean): { answer: T } | { shown: ReactNode } {
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  if (!index.byId.has(id)) return { shown: <div className={body}><p>There's no record with the ID <code>{id}</code>.</p></div> };
  if (read.state === 'refused') {
    return { shown: <div className={body}><Refusal title={`${id} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} /></div> };
  }
  if (read.state === 'read' && holds(read.answer)) return { answer: read.answer };
  return { shown: <div className={body}><p className="hint" role="status">Reading {id}…</p></div> };
}
