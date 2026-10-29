import type { ReactNode } from 'react';
import type { ToolingPage as Tooling } from '../../../../lathe/src/authoring/tooling/read-model';
import { Refusal, problemText } from '../../edit/fields';
import type { AggregatePageProps } from '../../record/pages';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import type { SpecIndex } from '../../specs/data';
import { ToolingEditor } from './ToolingEditor';
import { useTooling } from './reads';

// The Tooling page (LA-AUT-A21's page): a tooling record at its address (/<id>), drawn from its page read through the
// aggregate's own query (GET /api/tooling/get-tooling, read model LA-AUT-RM41) and changed only through its own
// commands (ToolingEditor): its file and the packages it uses. What every
// record's page holds around that (its Traceability with the standard rules it meets, problems, facts and links) is
// the Record page's (RecordFrame).

/** The tooling record's file and packages. */
function Content({ page }: { page: Tooling }) {
  const { tooling } = page;
  return (
    <>
      {tooling.file && <dl className="fields"><div data-field="file"><dt>File</dt><dd><code>{tooling.file}</code></dd></div></dl>}
      {page.packages.length > 0 && (
        <Section title="Packages" count={page.packages.length} className="record-packages">
          <ul className="plain">{page.packages.map((p) => <li key={p}><code>{p}</code></li>)}</ul>
        </Section>
      )}
    </>
  );
}

/** The tooling record's summary in the wiki card: a few key facts. */
function Summary({ index, page }: { index: SpecIndex; page: Tooling }) {
  const facts: { label: string; value: ReactNode }[] = [
    { label: 'Domain', value: <RecordLink index={index} id={page.tooling.domain_id} /> },
    ...(page.tooling.file ? [{ label: 'File', value: <code>{page.tooling.file}</code> }] : []),
    { label: 'Packages', value: page.packages.length },
  ];
  return (
    <>
      <dl className="fields">{facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
    </>
  );
}

/** A tooling record: its page (or its summary in the wiki card), with its editor's actions. */
export function ToolingPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useTooling(id, index);
  const record = index.byId.get(id);
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  if (!record) return <div className={body}><p>There's no record with the ID <code>{id}</code>.</p></div>;
  if (read.state === 'refused') {
    return <div className={body}><Refusal title={`${id} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} /></div>;
  }
  // Until the tooling record is read (or while the read is of data before it was added), the page says so.
  const page = read.state === 'read' && read.answer.tooling.id === id ? read.answer : null;
  if (!page) return <div className={body}><p className="hint" role="status">Reading {id}…</p></div>;
  return (
    <ToolingEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary index={index} page={page} />{after}</div>
      ) : (
        <div className={body} data-aggregate="tooling">
          <RecordFrame index={index} record={record}><Content page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </ToolingEditor>
  );
}
