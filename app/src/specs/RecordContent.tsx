import { lowerLabel } from '../plural';
import type { ReactNode } from 'react';
import { type SpecIndex, type SpecLink as Link, type SpecRecord } from './data';
import { addressOf } from '../views/address';
import { groupByLabel } from './labels';
import { Traceability } from './Traceability';
import { RecordText, factsOf, rowPlace } from './RecordText';
import { kindFieldPath, kindPagePath } from '../format/reference';
import { PatternRuleSections, PatternSections } from './PatternParts';
import { FlowSteps } from './FlowSteps';
import { StandardSections } from './StandardParts';
import { DomainEvents } from './DomainEvents';
import { LongList } from '../components/LongList';
import { DesktopRecordActions } from '../shell/desktopRecord';
import { Grouped, KindBadge, NavigateContext, StageFact, PageHeader, ProblemBadge, ProblemList, RecordLink, RecordTree, Section, SpecLink, TestStateTag, idText, isTestKind, listTitle, notAutomatedYet } from './parts';

// One record's content: header, text fields, problems, facts, parent, children and links both ways.
// Kept apart from the page chrome so another view (such as the graph, side by side) can host it.
// It lays itself out by its own width, so it reads at half the screen as well as full.

/** A record's links one way, grouped and named by their labels read from this record (LA-V92-R07). */
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

/** A pattern's followers have their own section. */
const PATTERN_SKIP: ReadonlySet<string> = new Set(['in:follows']);

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
   * the host shows them in its side bar; the body then lists the direct children itself.
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

/** The eyebrow over a record's title: its product and its domain as links, and its kind as a badge in its stage's color. */
export function RecordEyebrow({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const product = record.product ? index.byId.get(record.product) : undefined;
  const domain = record.domain ? index.byId.get(record.domain) : undefined;
  return (
    <>
      {product && record.kind !== 'product' && <><SpecLink to={addressOf(product.id)}>{product.title}</SpecLink> · </>}
      {domain && product && record.kind !== 'domain' && <><SpecLink to={addressOf(domain.id)}>{domain.title}</SpecLink> · </>}
      <KindBadge index={index} kind={record.kind} />
    </>
  );
}

function RecordBody({ index, record, actions, header, side }: { index: SpecIndex; record: SpecRecord; actions?: ReactNode; header: boolean; side: boolean }) {
  const { id } = record;
  // An aggregate's domain events and a flow's steps have their own sections, so its children list leaves them out.
  const children = (index.children.get(id) ?? []).filter((c) => !(record.kind === 'aggregate' && c.kind === 'domain_event') && !(record.kind === 'flow' && c.kind === 'flow_step'));
  const problems = index.problemsFor.get(id) ?? [];
  const isTest = isTestKind(index, record.kind);
  // A list of one kind is titled by that kind ("Commands"); a mixed one stays "Children".
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
          {isTest && notAutomatedYet(record) && (
            <p className="not-automated-note" role="note">
              <strong>Not automated yet.</strong> No file runs it, so it does not count as proof of what it proves.
            </p>
          )}
          <RecordText index={index} record={record} />
          {record.kind === 'pattern' && <PatternSections index={index} pattern={record} />}
          {record.kind === 'pattern_rule' && <PatternRuleSections index={index} rule={record} />}
          {record.kind === 'standard' && <StandardSections index={index} standard={record} />}
          {record.kind === 'flow' && <FlowSteps index={index} flow={record} />}
          {record.kind === 'aggregate' && <DomainEvents index={index} aggregate={record} />}
          {/* After the body and its kind's own sections, before the children. A pattern's followers have their own section. */}
          <Traceability index={index} record={record} skip={record.kind === 'pattern' ? PATTERN_SKIP : undefined} />
          {/* Without the facts beside it, the body lists the direct children itself (a pattern's and a standard's rules have their own sections); the problems show either way (the side bar does not repeat them). */}
          {!side && children.length > 0 && record.kind !== 'pattern' && record.kind !== 'standard' && (
            <Section title={childrenTitle} count={children.length}>
              {/* UC, view and API requirements and pattern and standard rules read under their groups. */}
              <Grouped records={children} level={3} render={(records, heading) => (
                <RecordTree index={index} records={records} label={heading ? `${heading}: ${childrenTitle} of ${id}` : `${childrenTitle} of ${id}`} showKind />
              )} />
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
 * Why a record has no parent: a product is the top; a kind with no owner exists because other records use it, and
 * belongs to the domain its ID names (a specification), to the one domain that uses it, or else is shared.
 */
export function parentlessText(index: SpecIndex, record: SpecRecord): string {
  if (record.kind === 'product') return 'None (top level).';
  const kind = index.kinds.get(record.kind);
  if ((kind?.parent_kinds.length ?? 0) > 0) return 'None (its parent is missing).';
  const domain = record.domain ? index.byId.get(record.domain)?.title ?? record.domain : null;
  if (kind?.id_scope === 'domain') return `None: it has no owner. It belongs to the domain its ID names${domain ? `, ${domain}` : ''}.`;
  return domain
    ? `None: it has no owner. It belongs to ${domain}, the one domain that uses it.`
    : 'None: it has no owner. It is shared: two or more domains use it, or none.';
}

/**
 * A record's facts: kind, stage, short fields, data file and line, parent, children (their own children folded) and
 * its links both ways. Shown beside the body, or in the side bar.
 */
export function RecordFacts({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const { id } = record;
  const kind = index.kinds.get(record.kind);
  const children = index.children.get(id) ?? [];
  const isTest = isTestKind(index, record.kind);
  // A test's state gets its own row, with its tag.
  const facts = factsOf(index, record);
  const childrenTitle = listTitle(index, children, 'Children');
  return (
    <>
      <dl className="fields">
        <div><dt>Kind</dt><dd title={kind?.description}><SpecLink to={kindPagePath(record.kind)} title={`How a ${lowerLabel(kind?.label ?? record.kind)} works`}>{kind?.label ?? record.kind}</SpecLink></dd></div>
        <StageFact index={index} kind={record.kind} />
        {isTest && <div><dt>State</dt><dd><TestStateTag record={record} /></dd></div>}
        {facts.map((f) => (
          <div key={f.label}>
            {/* A column's label leads to the column on the kind's page in the format reference. */}
            <dt>{f.column ? <SpecLink to={kindFieldPath(record.kind, f.column)} title={`The ${f.label} of a ${lowerLabel(kind?.label ?? record.kind)}`}>{f.label}</SpecLink> : f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
        <div><dt>Data file</dt><dd><code>{rowPlace(record)}</code><DesktopRecordActions id={id} /></dd></div>
      </dl>
      <h3>Parent</h3>
      {record.parent ? <RecordLink index={index} id={record.parent} /> : <p className="hint">{parentlessText(index, record)}</p>}
      <h3>{childrenTitle} <span className="section-count">{children.length}</span></h3>
      {children.length === 0 ? <p className="hint">None.</p> : <RecordTree index={index} records={children} label={childrenTitle} showKind bulk={false} />}
      <h3>Links out</h3>
      <LinkGroups index={index} links={index.outgoing.get(id) ?? []} direction="out" />
      <h3 id={`links-in-${id}`} tabIndex={-1} className="links-in-heading">Links in</h3>
      <LinkGroups index={index} links={index.incoming.get(id) ?? []} direction="in" />
    </>
  );
}
