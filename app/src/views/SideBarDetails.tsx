import type { MouseEvent, ReactNode } from 'react';
import { Button } from '../components/Button';
import { kindFieldPath, kindPagePath } from '../format/reference';
import { groupLabel, groupMarks, groupMembers } from '../graph/model';
import { treeGroup } from '../graph/tree';
import { GraphConnections, type GraphInfo } from '../graph/panel';
import { lowerLabel } from '../plural';
import { Link } from '../router';
import { DesktopRecordActions } from '../shell/desktopRecord';
import { kindLabel, problemOrder, type SpecIndex, type SpecRecord } from '../specs/data';
import { factsOf, rowPlace } from '../specs/RecordText';
import { ProblemList, RecordLink, StageFact, gapText, TestStateTag, isTestKind } from '../specs/parts';
import { parentlessText } from '../specs/RecordContent';
import { GAP_TEXT } from '../specs/Traceability';
import { traceOf } from '../specs/trace';
import type { SideMode } from './sideBarState';

// The side bar's Details (LA-V95-R06): what the page does not already show, with no repeats.
// The node under the pointer or keyboard focus on the stage, else the one selected (a stage's box
// tapped once, or a row of the wiki card focused or right-clicked), else the page's record: its
// kind, title, ID, short fields, data file and parent, and a compact Traceability summary in the
// relations' labels, with Open (and, in the desktop app, Reveal and Open in editor). The graph adds
// what it connects to the center.

export interface SideBarDetailsProps {
  index: SpecIndex;
  /** The page's record or group. */
  focus: string;
  /** The record or group to describe: hovered, selected, or the page's own. */
  target: string;
  mode: SideMode;
  /** How the target was chosen, for the line above its name. */
  how: 'hover' | 'selected' | 'page';
  graph: GraphInfo | null;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
}

export function SideBarDetails({ index, focus, target, mode, how, graph, onNavigate, hrefFor }: SideBarDetailsProps) {
  const record = index.byId.get(target);
  return (
    <>
      {record
        ? <RecordDetails index={index} record={record} focus={focus} how={how} onNavigate={onNavigate} hrefFor={hrefFor} />
        : <GroupDetails index={index} gid={target} focus={focus} how={how} onNavigate={onNavigate} hrefFor={hrefFor} />}
      {mode === 'graph' && graph && <GraphConnections index={index} info={graph} onNavigate={onNavigate} hrefFor={hrefFor} />}
    </>
  );
}

function Part({ title, count, id, children }: { title: string; count?: number; id: string; children: ReactNode }) {
  return (
    <section className="side-bar-section" aria-labelledby={id}>
      <h3 id={id}>{title}{count !== undefined && <span className="section-count">{count}</span>}</h3>
      {children}
    </section>
  );
}

const HOW: Record<'hover' | 'selected', string> = { hover: 'Under the pointer', selected: 'Selected' };

/** The name block: the kind, the title and the ID, with Open when it is not the page's own record. */
function Identity({ index, eyebrow, title, id, target, focus, how, onNavigate, hrefFor }: {
  index: SpecIndex; eyebrow: string; title: string; id?: string; target: string; focus: string; how: SideBarDetailsProps['how']; onNavigate: (id: string) => void; hrefFor: (id: string) => string;
}) {
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(target);
  };
  return (
    <div className="side-bar-identity">
      <p className="eyebrow">{how === 'page' ? eyebrow : `${HOW[how]} · ${eyebrow}`}</p>
      <p className="side-bar-name">{title}</p>
      <div className="side-identity-row">
        {id && <span className="record-id"><RecordLink index={index} id={id} showTitle={false} /></span>}
        {target !== focus && <Button href={hrefFor(target)} onClick={open} className="side-open">Open</Button>}
      </div>
    </div>
  );
}

/** A record in the canvas or a selected row: identity, short fields, data file, parent, problems and a compact Traceability. */
function RecordDetails({ index, record, focus, how, onNavigate, hrefFor }: { index: SpecIndex; record: SpecRecord; focus: string; how: SideBarDetailsProps['how']; onNavigate: (id: string) => void; hrefFor: (id: string) => string }) {
  const kind = index.kinds.get(record.kind);
  const isTest = isTestKind(index, record.kind);
  const facts = factsOf(index, record);
  const problems = [...(index.problemsFor.get(record.id) ?? [])].sort(problemOrder);
  return (
    <>
      <Identity index={index} eyebrow={kindLabel(index, record.kind)} title={record.title} id={record.id} target={record.id} focus={focus} how={how} onNavigate={onNavigate} hrefFor={hrefFor} />
      <dl className="fields">
        <div><dt>Kind</dt><dd title={kind?.description}><Link to={kindPagePath(record.kind)}>{kind?.label ?? record.kind}</Link></dd></div>
        <StageFact index={index} kind={record.kind} />
        {isTest && <div><dt>State</dt><dd><TestStateTag record={record} /></dd></div>}
        {facts.map((f) => (
          <div key={f.label}>
            {/* A column's label leads to the column on the kind's page in the format reference. */}
            <dt>{f.column ? <Link to={kindFieldPath(record.kind, f.column)} title={`The ${f.label} of a ${lowerLabel(kind?.label ?? record.kind)}`}>{f.label}</Link> : f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
        <div><dt>Data file</dt><dd><code>{rowPlace(record)}</code><DesktopRecordActions id={record.id} /></dd></div>
        <div><dt>Parent</dt><dd>{record.parent ? <RecordLink index={index} id={record.parent} /> : <span className="hint">{parentlessText(index, record)}</span>}</dd></div>
      </dl>
      {problems.length > 0 && (
        <Part title="Problems" count={problems.length} id="side-problems">
          <ProblemList index={index} problems={problems} showRecord={false} />
        </Part>
      )}
      <TraceSummary index={index} record={record} />
    </>
  );
}

/** How many IDs a Traceability line shows before "and n more". */
const TRACE_SHOWN = 4;

/** Traceability in brief: the gaps, then each group by its label with its count and its first few records. */
function TraceSummary({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const trace = traceOf(index, record);
  const gaps = trace.judgments.flatMap((j) => j.gaps.map((g) => ({ domain: j.domain, gap: g })));
  const groups = [
    ...(trace.requirements.length > 0 ? [{ key: 'requirements', label: 'UC requirements', ids: trace.requirements.map((r) => r.record.id) }] : []),
    ...trace.groups,
  ];
  const nothing = groups.length === 0 && gaps.length === 0 && !trace.runBy;
  return (
    <section className="side-bar-section side-trace" aria-labelledby="side-trace">
      <h3 id="side-trace" tabIndex={-1} className="links-in-heading">Traceability</h3>
      {nothing ? <p className="hint">Nothing links to or from it.</p> : (
        <>
          {gaps.length > 0 && (
            <ul className="plain side-bar-gaps">
              {gaps.map(({ domain, gap }) => (
                <li key={`${domain} ${gap.kind}`} data-gap={gap.kind}>{!record.domain && <><code>{domain}</code> </>}<strong>{GAP_TEXT[gap.kind].title}</strong></li>
              ))}
            </ul>
          )}
          <dl className="side-trace-groups">
            {groups.map((g) => (
              <div key={g.key}>
                <dt>{g.label} <span className="section-count">{g.ids.length}</span></dt>
                <dd>
                  {g.ids.slice(0, TRACE_SHOWN).map((id) => <RecordLink key={id} index={index} id={id} showTitle={false} />)}
                  {g.ids.length > TRACE_SHOWN && <span className="hint"> and {g.ids.length - TRACE_SHOWN} more</span>}
                </dd>
              </div>
            ))}
            {trace.runBy && <div><dt>Run by</dt><dd><code>{trace.runBy.file}</code>{trace.runBy.missing && <span className="badge error">file missing</span>}</dd></div>}
          </dl>
        </>
      )}
    </section>
  );
}

/** A group in the canvas: its kind, how many members, its parent, and the problems and gaps among its members. */
function GroupDetails({ index, gid, focus, how, onNavigate, hrefFor }: { index: SpecIndex; gid: string; focus: string; how: SideBarDetailsProps['how']; onNavigate: (id: string) => void; hrefFor: (id: string) => string }) {
  const group = treeGroup(index, gid);
  if (!group) return <p className="hint">There's no record or group <code>{gid}</code>.</p>;
  const members = groupMembers(index, gid);
  const marks = groupMarks(index, gid);
  return (
    <>
      <Identity index={index} eyebrow="Group" title={groupLabel(index, gid)} target={gid} focus={focus} how={how} onNavigate={onNavigate} hrefFor={hrefFor} />
      <dl className="fields">
        {group.kind && <div><dt>Kind</dt><dd title={index.kinds.get(group.kind)?.description}><Link to={kindPagePath(group.kind)}>{kindLabel(index, group.kind)}</Link></dd></div>}
        <div><dt>Members</dt><dd>{members.length}</dd></div>
        <div><dt>Parent</dt><dd><RecordLink index={index} id={group.owner} /></dd></div>
      </dl>
      <Part title="Problems and gaps among its members" id="side-group-marks">
        {marks.errors + marks.warnings === 0 && marks.gaps.length === 0 ? <p className="hint">None.</p> : (
          <ul className="plain side-bar-gaps">
            {marks.errors > 0 && <li className="problem error">{marks.errors} error{marks.errors > 1 ? 's' : ''}</li>}
            {marks.warnings > 0 && <li className="problem warning">{marks.warnings} warning{marks.warnings > 1 ? 's' : ''}</li>}
            {marks.gaps.map((g) => <li key={g}>Some: {gapText(g)}.</li>)}
          </ul>
        )}
      </Part>
    </>
  );
}
