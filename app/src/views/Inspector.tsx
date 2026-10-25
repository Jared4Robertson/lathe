import { forwardRef, type ReactNode } from 'react';
import { Icon } from '../components/icons';
import { GraphConnections, type GraphInfo } from '../graph/panel';
import { groupMarks, groupMembers, parseGroupId, pluralLabel } from '../graph/model';
import { kindLabel, problemOrder, type SpecIndex } from '../specs/data';
import { ProblemList, RecordLink, RecordTree, gapsOf } from '../specs/parts';
import { RecordFacts } from '../specs/RecordContent';
import { Tooltip } from '../shell/Tooltip';

// The inspector: the third column of a record, group, product or domain page (nav, main view,
// inspector). One inspector serves the whole page and shows the focused record, whichever view is
// open: its kind, fields, parent, children (their own children folded), links both ways, problems
// and coverage gaps; and, while the graph shows, what the graph connects to it.

export interface InspectorProps {
  index: SpecIndex;
  /** A record ID, or a group as `<parent-id>/<kind>`. */
  focus: string;
  /** What the graph draws, while a graph pane is shown. */
  graph: GraphInfo | null;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
  onClose: () => void;
  /** As a drawer on a narrow screen. */
  drawer?: boolean;
}

function Part({ title, count, id, children }: { title: string; count?: number; id: string; children: ReactNode }) {
  return (
    <section className="inspector-section" aria-labelledby={id}>
      <h3 id={id}>{title}{count !== undefined && <span className="section-count">{count}</span>}</h3>
      {children}
    </section>
  );
}

export const Inspector = forwardRef<HTMLElement, InspectorProps>(function Inspector({ index, focus, graph, onNavigate, hrefFor, onClose, drawer }, ref) {
  const record = index.byId.get(focus);
  const group = record ? null : parseGroupId(focus);
  return (
    <aside
      ref={ref}
      id="inspector"
      className={`inspector record-side${drawer ? ' is-drawer' : ''}`}
      aria-label="Inspector"
      tabIndex={-1}
    >
      <div className="inspector-head">
        <h2 className="inspector-title">Inspector</h2>
        <Tooltip label="Hide the inspector" command="toggleInspector" placement="left">
          <button type="button" className="icon-button" onClick={onClose} aria-label="Hide the inspector">
            <Icon name={drawer ? 'x' : 'sidebar-right'} />
          </button>
        </Tooltip>
      </div>
      {record && (
        <>
          <div className="inspector-identity">
            <p className="eyebrow">{kindLabel(index, record.kind)}</p>
            <p className="inspector-name">{record.title}</p>
            <p className="record-id"><RecordLink index={index} id={record.id} showTitle={false} /></p>
          </div>
          <RecordFacts index={index} record={record} />
          <Part title="Problems" count={(index.problemsFor.get(focus) ?? []).length} id="inspector-problems">
            <ProblemList index={index} problems={[...(index.problemsFor.get(focus) ?? [])].sort(problemOrder)} showRecord={false} />
          </Part>
          {index.kinds.get(record.kind)?.obligation && (
            <Part title="Coverage gaps" count={gapsOf(index, focus).length} id="inspector-gaps">
              {gapsOf(index, focus).length === 0 ? <p className="hint">Satisfied and proved.</p> : (
                <ul className="plain inspector-gaps">
                  {gapsOf(index, focus).map((g) => <li key={g}>{g === 'satisfies' ? 'No component satisfies it.' : 'No test proves it.'}</li>)}
                </ul>
              )}
            </Part>
          )}
        </>
      )}
      {group && <GroupFacts index={index} gid={focus} />}
      {graph && <GraphConnections index={index} info={graph} onNavigate={onNavigate} hrefFor={hrefFor} />}
    </aside>
  );
});

/** A group's facts: its parent, the kind of its members, their problems and gaps, and the members (folded). */
function GroupFacts({ index, gid }: { index: SpecIndex; gid: string }) {
  const { parent, kind } = parseGroupId(gid)!;
  const members = groupMembers(index, gid);
  const marks = groupMarks(index, gid);
  return (
    <>
      <div className="inspector-identity">
        <p className="eyebrow">Group</p>
        <p className="inspector-name">{pluralLabel(index, kind)} ({members.length})</p>
      </div>
      <dl className="fields">
        <div><dt>Kind</dt><dd title={index.kinds.get(kind)?.description}>{kindLabel(index, kind)}</dd></div>
        <div><dt>Members</dt><dd>{members.length}</dd></div>
      </dl>
      <h3>Parent</h3>
      <RecordLink index={index} id={parent} />
      <Part title="Problems and gaps among its members" id="inspector-group-marks">
        {marks.errors + marks.warnings === 0 && marks.gaps.length === 0 ? <p className="hint">None.</p> : (
          <ul className="plain inspector-gaps">
            {marks.errors > 0 && <li className="problem error">{marks.errors} error{marks.errors > 1 ? 's' : ''}</li>}
            {marks.warnings > 0 && <li className="problem warning">{marks.warnings} warning{marks.warnings > 1 ? 's' : ''}</li>}
            {marks.gaps.map((g) => <li key={g}>{g === 'satisfies' ? 'Some are not satisfied.' : 'Some are not proved.'}</li>)}
          </ul>
        )}
      </Part>
      <Part title="Members" count={members.length} id="inspector-members">
        <RecordTree index={index} records={members} label="Members" bulk={false} />
      </Part>
    </>
  );
}
