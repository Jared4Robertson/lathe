import type { ReactNode } from 'react';
import type { ExtensionRecordPage as Extension } from '../../../../lathe/src/authoring/extension-record/read-model';
import { Refusal, problemText } from '../../edit/fields';
import type { AggregatePageProps } from '../../record/pages';
import { Markdown } from '../../specs/Markdown';
import { Prose } from '../../specs/mentions';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { ExtensionRecordEditor } from './ExtensionRecordEditor';
import { useExtensionRecord } from './reads';

// The Extension record page (LA-AUT-A19's page): a record of a product's own kind at its address (/<id>), drawn from
// its page read through the aggregate's own query (GET /api/extension-record/get-extension-record, read model
// LA-AUT-RM39) and changed only through its own commands (ExtensionRecordEditor). Its shape is its kind's declaration:
// the field the kind leads with (statement, goal, meaning or description) as the lead, its other declared fields, the
// records it links to by relation and the packages it uses. What every record's page holds around that (Traceability,
// problems, facts and links both ways) is the Record page's (RecordFrame).

/** The fields a kind leads with, when it declares one. */
const LEAD_FIELDS = ['statement', 'goal', 'meaning', 'description'];

const leadOf = (page: Extension) => LEAD_FIELDS.find((f) => typeof page.values[f] === 'string');
const labelOf = (column: string) => column.charAt(0).toUpperCase() + column.slice(1).replaceAll('_', ' ');
const textOf = (value: unknown) => (Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value));

/** The record's lead, its other fields, its links by relation and its packages. */
function Content({ index, page }: { index: RecordIndex; page: Extension }) {
  const lead = leadOf(page);
  const fields = Object.entries(page.values).filter(([column]) => column !== 'title' && column !== lead);
  const relations = index.workspace.schema.relations;
  return (
    <>
      {lead && <div className="record-lead" data-field={lead}><Prose index={index} source={String(page.values[lead])} self={page.id} /></div>}
      {fields.length > 0 && (
        <dl className="fields extension-fields">
          {fields.map(([column, value]) => (
            <div key={column} data-field={column}>
              <dt>{labelOf(column)}</dt>
              <dd>{typeof value === 'string' ? <Prose index={index} source={value} self={page.id} /> : textOf(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {Object.entries(page.links).map(([relation, targets]) => {
        const words = relations[relation]?.forwardLabel ?? relation;
        return (
          <Section key={relation} title={labelOf(words)} count={targets.length} level={3} className="extension-links">
            <ul className="plain">{targets.map((t) => <li key={t}><RecordLink index={index} id={t} /></li>)}</ul>
          </Section>
        );
      })}
      {page.packages.length > 0 && (
        <Section title="Packages" count={page.packages.length} className="record-packages">
          <ul className="plain">{page.packages.map((p) => <li key={p}><code>{p}</code></li>)}</ul>
        </Section>
      )}
    </>
  );
}

/** The record's summary in the wiki card: its lead and a few key facts. */
function Summary({ index, page }: { index: RecordIndex; page: Extension }) {
  const lead = leadOf(page);
  const parentKind = index.byId.get(page.parent)?.kind;
  const facts: { label: string; value: ReactNode }[] = [
    { label: parentKind ? labelOf(index.workspace.schema.kinds[parentKind]?.label ?? parentKind) : 'Under', value: <RecordLink index={index} id={page.parent} /> },
    ...Object.entries(page.values).filter(([c]) => c !== 'title' && c !== lead).slice(0, 2).map(([c, v]) => ({ label: labelOf(c), value: textOf(v) })),
  ];
  return (
    <>
      {lead && <div className="wiki-panel-lead"><Markdown source={String(page.values[lead])} /></div>}
      <dl className="fields">{facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
    </>
  );
}

/** A record of a product's own kind: its page (or its summary in the wiki card), with its editor's actions. */
export function ExtensionRecordPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useExtensionRecord(id, index);
  const record = index.byId.get(id);
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  if (!record) return <div className={body}><p>There's no record with the ID <code>{id}</code>.</p></div>;
  if (read.state === 'refused') {
    return <div className={body}><Refusal title={`${id} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} /></div>;
  }
  // Until the record is read (or while the read is of data before it was added), the page says so.
  const page = read.state === 'read' && read.answer.id === id ? read.answer : null;
  if (!page) return <div className={body}><p className="hint" role="status">Reading {id}…</p></div>;
  return (
    <ExtensionRecordEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary index={index} page={page} />{after}</div>
      ) : (
        <div className={body} data-aggregate="extension-record">
          <RecordFrame index={index} record={record}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </ExtensionRecordEditor>
  );
}
