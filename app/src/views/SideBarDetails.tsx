import type { MouseEvent, ReactNode } from 'react';
import { Button } from '../components/Button';
import { LongList } from '../components/LongList';
import { kindFieldPath, kindPagePath } from '../format/reference';
import { groupLabel, groupMarks, groupMembers, groupOwner, isGroup, parseGroupId } from '../graph/model';
import { treeGroup } from '../graph/tree';
import { GraphConnections, type GraphInfo } from '../graph/panel';
import { lowerLabel } from '../plural';
import { Link } from '../router';
import { DesktopRecordActions } from '../shell/desktopRecord';
import { kindLabel, problemOrder, type SpecIndex, type SpecRecord } from '../specs/data';
import { ProblemList, RecordLink, RecordTree, TestStateTag, idText, listTitle } from '../specs/parts';
import { GAP_TEXT } from '../specs/Traceability';
import { traceOf } from '../specs/trace';
import type { SideMode } from './sideBarState';

// The side bar's Details (LA-EXP-UC12-R03): what the page does not already show, with no repeats.
// - In the Graph and Model views: the node under the pointer or keyboard focus, else the selected
//   one, else the page's record: its kind, title, ID, header fields, spec file and parent, and a
//   compact Traceability summary in the relations' labels, with Open (and, in the desktop app,
//   Reveal and Open in editor). The graph adds what it connects to the center.
// - In the Wiki view: a record row that has focus or was right-clicked, as above; otherwise only
//   what the page leaves out: the spec file, the raw header fields and the raw links.

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
  const pageFacts = mode === 'wiki' && how === 'page';
  const record = index.byId.get(target);
  return (
    <>
      {pageFacts
        ? (record ? <RawFacts index={index} record={record} /> : <RawGroupFacts index={index} gid={target} />)
        : (record
          ? <RecordDetails index={index} record={record} focus={focus} how={how} onNavigate={onNavigate} hrefFor={hrefFor} />
          : <GroupDetails index={index} gid={target} focus={focus} how={how} onNavigate={onNavigate} hrefFor={hrefFor} />)}
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

/** A record in the canvas or a selected row: identity, header fields, spec file, parent, problems and a compact Traceability. */
function RecordDetails({ index, record, focus, how, onNavigate, hrefFor }: { index: SpecIndex; record: SpecRecord; focus: string; how: SideBarDetailsProps['how']; onNavigate: (id: string) => void; hrefFor: (id: string) => string }) {
  const kind = index.kinds.get(record.kind);
  const isTest = record.kind === 'test';
  const fields = Object.entries(record.fields).filter(([name]) => !(isTest && name === 'state'));
  const problems = [...(index.problemsFor.get(record.id) ?? [])].sort(problemOrder);
  return (
    <>
      <Identity index={index} eyebrow={kindLabel(index, record.kind)} title={record.title} id={record.id} target={record.id} focus={focus} how={how} onNavigate={onNavigate} hrefFor={hrefFor} />
      <dl className="fields">
        <div><dt>Kind</dt><dd title={kind?.description}><Link to={kindPagePath(record.kind)}>{kind?.label ?? record.kind}</Link></dd></div>
        {isTest && <div><dt>State</dt><dd><TestStateTag record={record} /></dd></div>}
        {fields.map(([name, value]) => (
          <div key={name}>
            {/* A required field's label leads to the field on the kind's page in the format reference. */}
            <dt>{kind?.required_fields.includes(name) ? <Link to={kindFieldPath(record.kind, name)} title={`Required of every ${lowerLabel(kind.label)}`}>{name.replaceAll('_', ' ')}</Link> : name.replaceAll('_', ' ')}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div><dt>Spec file</dt><dd><code>{record.path}</code><DesktopRecordActions id={record.id} /></dd></div>
        <div><dt>Parent</dt><dd>{record.parent ? <RecordLink index={index} id={record.parent} /> : <span className="hint">None (top level)</span>}</dd></div>
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
    ...(trace.requirements.length > 0 ? [{ key: 'requirements', label: 'Requirements', ids: trace.requirements.map((r) => r.record.id) }] : []),
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
            {marks.gaps.map((g) => <li key={g}>{g === 'satisfies' ? 'Some are not satisfied.' : 'Some are not proved.'}</li>)}
          </ul>
        )}
      </Part>
    </>
  );
}

// ---------- In the Wiki view, with nothing selected: only what the page does not show ----------

/** The record as its file has it: the spec file, the raw header fields and the raw links both ways. */
function RawFacts({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const header: [string, string][] = [
    ['id', record.id],
    ['kind', record.kind],
    ['title', record.title],
    ...(record.parent ? [['parent', record.parent] as [string, string]] : []),
    ...Object.entries(record.fields),
  ];
  const out = index.outgoing.get(record.id) ?? [];
  const into = index.incoming.get(record.id) ?? [];
  return (
    <>
      <section className="side-bar-section" aria-labelledby="side-file">
        <h3 id="side-file">Spec file</h3>
        <p className="side-file"><code>{record.path}</code></p>
        <DesktopRecordActions id={record.id} />
      </section>
      <section className="side-bar-section" aria-labelledby="side-header">
        <h3 id="side-header">Header fields</h3>
        <dl className="fields side-raw">
          {header.map(([name, value]) => <div key={name}><dt><code>{name}</code></dt><dd>{name === 'parent' ? <RecordLink index={index} id={value} showTitle={false} /> : <code>{value}</code>}</dd></div>)}
        </dl>
      </section>
      <section className="side-bar-section" aria-labelledby="side-links-out">
        <h3 id="side-links-out">Links out <span className="section-count">{out.length}</span></h3>
        <RawLinks index={index} links={out.map((l) => ({ relation: l.relation, id: l.target }))} label="Links out" empty="This record links to nothing." />
      </section>
      <section className="side-bar-section" aria-labelledby="side-links-in">
        <h3 id="side-links-in" tabIndex={-1} className="links-in-heading">Links in <span className="section-count">{into.length}</span></h3>
        <RawLinks index={index} links={into.map((l) => ({ relation: l.relation, id: l.source }))} label="Links in" empty="Nothing links to this record." />
      </section>
      {(record.kind === 'product' || record.kind === 'domain') && <OverviewFacts index={index} record={record} />}
    </>
  );
}

/**
 * A product's or a domain's page is its overview, which lists its domains or its folders but not
 * the record's own parent, children and problems: those stay in Details.
 */
function OverviewFacts({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const children = index.children.get(record.id) ?? [];
  const problems = [...(index.problemsFor.get(record.id) ?? [])].sort(problemOrder);
  const childrenTitle = listTitle(index, children, 'Children');
  return (
    <>
      <Part title="Parent" id="side-parent">
        {record.parent ? <RecordLink index={index} id={record.parent} /> : <p className="hint">None (top level).</p>}
      </Part>
      <Part title={childrenTitle} count={children.length} id="side-children">
        {children.length === 0 ? <p className="hint">None.</p> : <RecordTree index={index} records={children} label={childrenTitle} showKind bulk={false} />}
      </Part>
      <Part title="Problems" count={problems.length} id="side-own-problems">
        <ProblemList index={index} problems={problems} showRecord={false} />
      </Part>
    </>
  );
}

/** Links as the header writes them: the relation's name and the other record's ID. */
function RawLinks({ index, links, label, empty }: { index: SpecIndex; links: { relation: string; id: string }[]; label: string; empty: string }) {
  if (links.length === 0) return <p className="hint">{empty}</p>;
  return (
    <LongList
      label={label}
      className="plain side-raw-links"
      items={links}
      itemKey={(l) => `${l.relation} ${l.id}`}
      searchText={(l) => `${l.relation} ${idText(index, l.id)}`}
      render={(l) => <><code className="side-relation">{l.relation}</code> <RecordLink index={index} id={l.id} showTitle={false} /></>}
    />
  );
}

/** A group page has no file of its own: its kind and parent, as its address names them. */
function RawGroupFacts({ index, gid }: { index: SpecIndex; gid: string }) {
  const parsed = parseGroupId(gid);
  if (!parsed || !isGroup(index, gid)) return <p className="hint">There's no record or group <code>{gid}</code>.</p>;
  return (
    <section className="side-bar-section" aria-labelledby="side-group">
      <h3 id="side-group">Group</h3>
      <p className="hint">A group has no spec file of its own: its address names it by its parent and its place in the tree. Select a row to see that record's details.</p>
      <dl className="fields side-raw">
        <div><dt>Name</dt><dd>{groupLabel(index, gid)}</dd></div>
        <div><dt><code>parent</code></dt><dd><RecordLink index={index} id={groupOwner(index, gid)} showTitle={false} /></dd></div>
        <div><dt><code>path</code></dt><dd><code>{[parsed.kind, ...parsed.path].join('/')}</code></dd></div>
      </dl>
    </section>
  );
}
