import type { ReactNode } from 'react';
import type { EntryPointPage as EntryPoint } from '../../../../lathe/src/technical-specification/entry-point/read-model';
import { Refusal, problemText } from '../../edit/fields';
import type { AggregatePageProps } from '../../record/pages';
import { Markdown } from '../../specs/Markdown';
import { Prose } from '../../specs/mentions';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { EntryPointEditor } from './EntryPointEditor';
import { useEntryPoint } from './reads';

// The Entry point page (LA-TEC-A20's page): an entry point at its address (/<id>), drawn from its page read through the
// aggregate's own query (GET /api/entry-point/get-entry-point, read model LA-TEC-RM40) and changed only through its own
// commands (EntryPointEditor): what it does at start-up as the lead, its file, and the packages it uses. What every
// record's page holds around that (its Traceability with the standard rules it meets, problems, facts and links) is
// the Record page's (RecordFrame).

/** The entry point's file and packages. */
function Content({ index, page }: { index: RecordIndex; page: EntryPoint }) {
  const { entryPoint } = page;
  return (
    <>
      <div className="record-lead" data-field="description"><Prose index={index} source={entryPoint.description} self={entryPoint.id} /></div>
      {entryPoint.file && <dl className="fields"><div data-field="file"><dt>File</dt><dd><code>{entryPoint.file}</code></dd></div></dl>}
      {page.packages.length > 0 && (
        <Section title="Packages" count={page.packages.length} className="record-packages">
          <ul className="plain">{page.packages.map((p) => <li key={p}><code>{p}</code></li>)}</ul>
        </Section>
      )}
    </>
  );
}

/** The entry point's summary in the wiki card: what it does and a few key facts. */
function Summary({ index, page }: { index: RecordIndex; page: EntryPoint }) {
  const facts: { label: string; value: ReactNode }[] = [
    { label: 'Domain', value: <RecordLink index={index} id={page.entryPoint.domain_id} /> },
    ...(page.entryPoint.file ? [{ label: 'File', value: <code>{page.entryPoint.file}</code> }] : []),
    { label: 'Packages', value: page.packages.length },
  ];
  return (
    <>
      <div className="wiki-panel-lead"><Markdown source={page.entryPoint.description} /></div>
      <dl className="fields">{facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
    </>
  );
}

/** An entry point: its page (or its summary in the wiki card), with its editor's actions. */
export function EntryPointPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useEntryPoint(id, index);
  const record = index.byId.get(id);
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  if (!record) return <div className={body}><p>There's no record with the ID <code>{id}</code>.</p></div>;
  if (read.state === 'refused') {
    return <div className={body}><Refusal title={`${id} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} /></div>;
  }
  // Until the entry point is read (or while the read is of data before it was added), the page says so.
  const page = read.state === 'read' && read.answer.entryPoint.id === id ? read.answer : null;
  if (!page) return <div className={body}><p className="hint" role="status">Reading {id}…</p></div>;
  return (
    <EntryPointEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary index={index} page={page} />{after}</div>
      ) : (
        <div className={body} data-aggregate="entry-point">
          <RecordFrame index={index} record={record}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </EntryPointEditor>
  );
}
