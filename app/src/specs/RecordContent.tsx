import { lowerLabel } from '../plural';
import type { ReactNode } from 'react';
import { kindLabel, type SpecIndex, type SpecLink as Link, type SpecRecord } from './data';
import { addressOf } from '../views/address';
import { groupByLabel, relationLabelOf } from './labels';
import { Traceability } from './Traceability';
import { RecordMarkdown } from './mentions';
import { kindFieldPath, kindPagePath } from '../format/reference';
import { PatternRuleSections, PatternSections } from './PatternParts';
import { FlowSteps } from './FlowSteps';
import { LongList } from '../components/LongList';
import { DesktopRecordActions } from '../shell/desktopRecord';
import { NavigateContext, PageHeader, ProblemBadge, ProblemList, RecordLink, RecordTree, Section, SpecLink, TestStateTag, idText, listTitle, testState } from './parts';

// One record's content: header, body, problems, fields, parent, children and links both ways.
// Kept apart from the page chrome so another view (such as the graph, side by side) can host it.
// It lays itself out by its own width, so it reads at half the screen as well as full.

/** A record's links one way, grouped and named by their labels read from this record (LA-BRW-DR243). */
function LinkGroups({ index, links, direction }: { index: SpecIndex; links: Link[]; direction: 'out' | 'in' }) {
  if (links.length === 0) return <p className="hint">{direction === 'out' ? 'This record links to nothing.' : 'Nothing links to this record.'}</p>;
  return (
    <dl className="link-groups">
      {groupByLabel(index, links, direction === 'out' ? 'source' : 'target').map(({ label: name, ids }) => {
        return (
          <div key={name}>
            <dt>{name}</dt>
            <dd>
              <LongList
                label={`${direction === 'out' ? 'Links out' : 'Links in'}: ${name}`}
                className="plain link-list"
                items={ids}
                itemKey={(id) => id}
                searchText={(id) => idText(index, id)}
                render={(id) => <RecordLink index={index} id={id} />}
              />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

const PATTERN_SKIP: ReadonlySet<string> = new Set(['in:follows']);

/** For an interaction requirement:the view, endpoint or flow it sits at, and what it carries out. */
function Fulfills({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const parent = record.parent ? index.byId.get(record.parent) : undefined;
  const targets = (index.outgoing.get(record.id) ?? []).filter((l) => l.relation === 'fulfills').map((l) => l.target);
  const title = relationLabelOf(index.workspace.relations, 'fulfills');
  return (
    <Section title={title} count={targets.length}>
      {parent && (
        <p className="fulfills-at">
          At the {lowerLabel(kindLabel(index, parent.kind))} <RecordLink index={index} id={parent.id} />
        </p>
      )}
      {targets.length === 0 ? (
        <p className="hint">It carries out nothing yet. Link it with <code>fulfills</code> to the requirement or domain rule it carries out.</p>
      ) : (
        <LongList
          label={title}
          className="record-list fulfills"
          items={targets}
          itemKey={(t) => t}
          searchText={(t) => idText(index, t)}
          render={(t) => {
            const target = index.byId.get(t);
            return (
              <>
                <RecordLink index={index} id={t} row />
                {target && <small className="meta">{kindLabel(index, target.kind)}</small>}
              </>
            );
          }}
        />
      )}
    </Section>
  );
}

export interface RecordContentProps {
  index: SpecIndex;
  id: string;
  /**
   * Called with the address of a link the person follows inside the content. When absent, the
   * whole app moves to that address. Links stay real links, so a modified click opens a new tab.
   */
  onNavigate?: (to: string) => void;
  /** Extra controls for the header. */
  actions?: ReactNode;
  /** Draw the header (title, ID, kind). Off when the host draws its own, as the focus page does. */
  header?: boolean;
  /**
   * Draw the record's facts (fields, parent, children, links, problems) beside the body. Off when
   * the host shows them in its inspector; the body then lists the direct children itself.
   */
  side?: boolean;
}

export function RecordContent({ index, id, onNavigate, actions, header = true, side = true }: RecordContentProps) {
  const record = index.byId.get(id);
  const body = record ? <RecordBody index={index} record={record} actions={actions} header={header} side={side} /> : (
    <div className="placeholder"><p>There's no record with the ID <code>{id}</code>.</p></div>
  );
  return (
    <NavigateContext.Provider value={onNavigate ?? null}>
      <div className="record-content">{body}</div>
    </NavigateContext.Provider>
  );
}

/** The eyebrow over a record's title: its product, its domain and its kind, as links. */
export function RecordEyebrow({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const kind = index.kinds.get(record.kind);
  const product = record.product ? index.byId.get(record.product) : undefined;
  const domain = record.domain ? index.byId.get(record.domain) : undefined;
  return (
    <>
      {product && record.kind !== 'product' && <><SpecLink to={addressOf(product.id)}>{product.title}</SpecLink> · </>}
      {domain && product && record.kind !== 'domain' && <><SpecLink to={addressOf(domain.id)}>{domain.title}</SpecLink> · </>}
      {kind?.label ?? record.kind}
    </>
  );
}

function RecordBody({ index, record, actions, header, side }: { index: SpecIndex; record: SpecRecord; actions?: ReactNode; header: boolean; side: boolean }) {
  const { id } = record;
  const children = index.children.get(id) ?? [];
  const problems = index.problemsFor.get(id) ?? [];
  const isTest = record.kind === 'test';
  // A list of one kind is titled by that kind ("Domain rules"); a mixed one stays "Children".
  const childrenTitle = listTitle(index, children, 'Children');
  return (
    <>
      {header && (
        <PageHeader eyebrow={<RecordEyebrow index={index} record={record} />} title={record.title} id={id}>
          <ProblemBadge problems={problems} />
          {actions}
        </PageHeader>
      )}
      <div className={side ? 'record-layout' : 'record-layout single'}>
        <div className="record-main">
          {isTest && testState(record) === 'planned' && (
            <p className="planned-note" role="note">
              <strong>Planned test.</strong> It is not written yet, so it does not count as proof of what it proves.
            </p>
          )}
          <RecordMarkdown index={index} record={record} />
          {record.kind === 'interaction_requirement' && <Fulfills index={index} record={record} />}
          {record.kind === 'pattern' && <PatternSections index={index} pattern={record} />}
          {record.kind === 'pattern_rule' && <PatternRuleSections index={index} rule={record} />}
          {record.kind === 'flow' && <FlowSteps index={index} flow={record} />}
          {/* After the body and its kind's own sections, before the children. A pattern's followers have their own section. */}
          <Traceability index={index} record={record} skip={record.kind === 'pattern' ? PATTERN_SKIP : undefined} />
          {/* Without the facts beside it, the body lists the direct children itself; the problems show either way (the side bar does not repeat them). */}
          {!side && children.length > 0 && record.kind !== 'pattern' && (
            <Section title={childrenTitle} count={children.length}>
              <RecordTree index={index} records={children} label={`${childrenTitle} of ${id}`} showKind />
            </Section>
          )}
          <Section title="Problems" count={problems.length}>
            <ProblemList index={index} problems={problems} showRecord={false} />
          </Section>
        </div>
        {side && <aside className="record-side"><RecordFacts index={index} record={record} /></aside>}
      </div>
    </>
  );
}

/**
 * A record's facts: kind, fields, spec file, parent, children (their own children folded) and its
 * links both ways. Shown beside the body, or in the inspector.
 */
export function RecordFacts({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const { id } = record;
  const kind = index.kinds.get(record.kind);
  const children = index.children.get(id) ?? [];
  const isTest = record.kind === 'test';
  // A test's state gets its own row, with its tag.
  const fields = Object.entries(record.fields).filter(([name]) => !(isTest && name === 'state'));
  const childrenTitle = listTitle(index, children, 'Children');
  return (
    <>
      <dl className="fields">
        <div><dt>Kind</dt><dd title={kind?.description}><SpecLink to={kindPagePath(record.kind)} title={`How a ${lowerLabel(kind?.label ?? record.kind)} works`}>{kind?.label ?? record.kind}</SpecLink></dd></div>
        {isTest && <div><dt>State</dt><dd><TestStateTag record={record} /></dd></div>}
        {fields.map(([name, value]) => (
          <div key={name}>
            {/* A required field's label leads to the field on the kind's page in the format reference. */}
            <dt>{kind?.required_fields.includes(name) ? <SpecLink to={kindFieldPath(record.kind, name)} title={`Required of every ${lowerLabel(kind.label)}`}>{name.replaceAll('_', ' ')}</SpecLink> : name.replaceAll('_', ' ')}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div><dt>Spec file</dt><dd><code>{record.path}</code><DesktopRecordActions id={id} /></dd></div>
      </dl>
      <h3>Parent</h3>
      {record.parent ? <RecordLink index={index} id={record.parent} /> : <p className="hint">None (top level).</p>}
      <h3>{childrenTitle} <span className="section-count">{children.length}</span></h3>
      {children.length === 0 ? <p className="hint">None.</p> : <RecordTree index={index} records={children} label={childrenTitle} showKind bulk={false} />}
      <h3>Links out</h3>
      <LinkGroups index={index} links={index.outgoing.get(id) ?? []} direction="out" />
      <h3 id={`links-in-${id}`} tabIndex={-1} className="links-in-heading">Links in</h3>
      <LinkGroups index={index} links={index.incoming.get(id) ?? []} direction="in" />
    </>
  );
}
