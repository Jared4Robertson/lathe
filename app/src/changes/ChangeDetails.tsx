import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { RecordLink } from '../specs/parts';
import { valueText } from '../views/history';
import { SINCE_LABELS, SINCES, useChanges, type RecordChange, type Since } from './changes';
import './changes.css';

// One record's change from the baseline, as the wiki card's Changes section and the Changes panel show it
// (LA-EXP-UC15): each changed field old → new, each part row added, removed or changed, and the links added and removed.

/** What a change is called: "Changed", "New", "Removed". */
export const CHANGE_LABEL: Record<RecordChange['change'], string> = { changed: 'Changed', added: 'New', removed: 'Removed' };

const words = (name: string) => name.replaceAll('_', ' ');

/** A field's value before and after: the old struck through, the new after an arrow. */
function OldNew({ before, after }: { before?: unknown; after?: unknown }) {
  return (
    <>
      {before !== undefined && <del className="change-before">{valueText(before as never)}</del>}
      {before !== undefined && after !== undefined && <span className="change-arrow" aria-label="becomes"> → </span>}
      {after !== undefined && <ins className="change-after">{valueText(after as never)}</ins>}
    </>
  );
}

/** A changed record's fields, parts and links, before and after. */
export function ChangeDetails({ index, change }: { index: RecordIndex; change: RecordChange }) {
  if (change.change !== 'changed') return null;
  const { fields, parts, links } = change;
  return (
    <div className="change-details">
      {fields.length > 0 && (
        <dl className="fields change-fields">
          {fields.map((f) => <div key={f.name}><dt>{words(f.name)}</dt><dd><OldNew before={f.before} after={f.after} /></dd></div>)}
        </dl>
      )}
      {parts.map((p) => (
        <section key={`${p.table} ${p.key}`} className={`change-part is-${p.change}`}>
          <h4>{words(p.table)} <code>{p.key}</code> <small>{p.change}</small></h4>
          <dl className="fields change-fields">
            {p.fields.map((f) => <div key={f.name}><dt>{words(f.name)}</dt><dd><OldNew before={f.before} after={f.after} /></dd></div>)}
          </dl>
        </section>
      ))}
      {(links.added.length > 0 || links.removed.length > 0) && (
        <ul className="plain change-links" aria-label="Links added and removed">
          {links.added.map((l) => <li key={`+${l.relation} ${l.target}`} className="is-added"><span className="change-sign">Added</span> {words(l.relation)} <RecordLink index={index} id={l.target} /></li>)}
          {links.removed.map((l) => <li key={`-${l.relation} ${l.target}`} className="is-removed"><span className="change-sign">Removed</span> {words(l.relation)} <RecordLink index={index} id={l.target} /></li>)}
        </ul>
      )}
    </div>
  );
}

/** What a change touched, in a few words: "title, statement, 2 links". */
export function changeSummary(change: RecordChange): string {
  if (change.change !== 'changed') return CHANGE_LABEL[change.change];
  const links = change.links.added.length + change.links.removed.length;
  const parts = [...change.fields.map((f) => words(f.name)), ...new Set(change.parts.map((p) => words(p.table)))];
  if (links) parts.push(links === 1 ? '1 link' : `${links} links`);
  return parts.join(', ');
}

/** The baseline picker: what Highlight changes, the panel and the card compare with. */
export function SincePicker({ className }: { className?: string }) {
  const { since, setSince, baseline } = useChanges();
  return (
    <label className={className ? `changes-since ${className}` : 'changes-since'} title={baseline.state === 'ok' ? `Compared with ${baseline.detail}` : undefined}>
      <span className="changes-since-name">Compared with</span>
      <select value={since} onChange={(e) => setSince(e.target.value as Since)}>
        {SINCES.map((s) => <option key={s} value={s}>{SINCE_LABELS[s]}</option>)}
      </select>
    </label>
  );
}
