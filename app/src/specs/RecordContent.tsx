import type { ReactNode } from 'react';
import { domainPath, kindLabel, productPath, relationLabel, type SpecIndex, type SpecLink as Link, type SpecRecord } from './data';
import { Markdown } from './Markdown';
import { LongList } from './LongList';
import { NavigateContext, PageHeader, ProblemBadge, ProblemList, RecordLink, Section, SpecLink, TestStateTag, idText, recordText, testState } from './parts';

// One record's content: header, body, problems, fields, parent, children and links both ways.
// Kept apart from the page chrome so another view (such as the graph, side by side) can host it.
// It lays itself out by its own width, so it reads at half the screen as well as full.

function groupByRelation(links: Link[]) {
  const groups = new Map<string, Link[]>();
  for (const l of links) groups.set(l.relation, [...(groups.get(l.relation) ?? []), l]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function LinkGroups({ index, links, direction }: { index: SpecIndex; links: Link[]; direction: 'out' | 'in' }) {
  if (links.length === 0) return <p className="hint">{direction === 'out' ? 'This record links to nothing.' : 'Nothing links to this record.'}</p>;
  return (
    <dl className="link-groups">
      {groupByRelation(links).map(([relation, group]) => {
        const name = direction === 'out' ? relationLabel(relation) : `${relationLabel(relation)} this`;
        const ids = group.map((l) => (direction === 'out' ? l.target : l.source)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
        return (
          <div key={relation}>
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

/** For an interaction requirement: the view, endpoint or flow it sits at, and what it carries out. */
function Fulfills({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const parent = record.parent ? index.byId.get(record.parent) : undefined;
  const targets = (index.outgoing.get(record.id) ?? []).filter((l) => l.relation === 'fulfills').map((l) => l.target);
  return (
    <Section title="Fulfills" count={targets.length}>
      {parent && (
        <p className="fulfills-at">
          At the {kindLabel(index, parent.kind).toLowerCase()} <RecordLink index={index} id={parent.id} />
        </p>
      )}
      {targets.length === 0 ? (
        <p className="hint">It fulfills nothing yet. Link it with <code>fulfills</code> to the requirement or domain rule it carries out.</p>
      ) : (
        <LongList
          label="Fulfills"
          className="record-list fulfills"
          items={targets}
          itemKey={(t) => t}
          searchText={(t) => idText(index, t)}
          render={(t) => {
            const target = index.byId.get(t);
            return (
              <>
                <RecordLink index={index} id={t} />
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
  /** Extra controls for the header, such as "Open in graph". */
  actions?: ReactNode;
}

export function RecordContent({ index, id, onNavigate, actions }: RecordContentProps) {
  const record = index.byId.get(id);
  const body = record ? <RecordBody index={index} record={record} actions={actions} /> : (
    <div className="placeholder"><p>There's no record with the ID <code>{id}</code>.</p></div>
  );
  return (
    <NavigateContext.Provider value={onNavigate ?? null}>
      <div className="record-content">{body}</div>
    </NavigateContext.Provider>
  );
}

function RecordBody({ index, record, actions }: { index: SpecIndex; record: SpecRecord; actions?: ReactNode }) {
  const { id } = record;
  const kind = index.kinds.get(record.kind);
  const children = index.children.get(id) ?? [];
  const problems = index.problemsFor.get(id) ?? [];
  const isTest = record.kind === 'test';
  // A test's state gets its own row, with its tag.
  const fields = Object.entries(record.fields).filter(([name]) => !(isTest && name === 'state'));
  const product = record.product ? index.byId.get(record.product) : undefined;
  const domain = record.domain ? index.byId.get(record.domain) : undefined;
  return (
    <>
      <PageHeader
        eyebrow={<>
          {product && record.kind !== 'product' && <><SpecLink to={productPath(product.id)}>{product.title}</SpecLink> · </>}
          {domain && product && record.kind !== 'domain' && <><SpecLink to={domainPath(product.id, domain.id)}>{domain.title}</SpecLink> · </>}
          {kind?.label ?? record.kind}
        </>}
        title={record.title}
        id={id}
      >
        <ProblemBadge problems={problems} />
        {actions}
      </PageHeader>
      <div className="record-layout">
        <div className="record-main">
          {isTest && testState(record) === 'planned' && (
            <p className="planned-note" role="note">
              <strong>Planned test.</strong> It is not written yet, so it does not count as proof of what it proves.
            </p>
          )}
          <Markdown source={record.body} />
          {record.kind === 'interaction_requirement' && <Fulfills index={index} record={record} />}
          <Section title="Problems" count={problems.length}>
            <ProblemList index={index} problems={problems} showRecord={false} />
          </Section>
          {record.kind === 'product' && <p><SpecLink to={productPath(id)}>Open the product overview</SpecLink></p>}
          {record.kind === 'domain' && record.product && <p><SpecLink to={domainPath(record.product, id)}>Open the domain overview</SpecLink></p>}
        </div>
        <aside className="record-side">
          <dl className="fields">
            <div><dt>Kind</dt><dd title={kind?.description}>{kind?.label ?? record.kind}</dd></div>
            {isTest && <div><dt>State</dt><dd><TestStateTag record={record} /></dd></div>}
            {fields.map(([name, value]) => (
              <div key={name}><dt>{name.replaceAll('_', ' ')}</dt><dd>{value}</dd></div>
            ))}
            <div><dt>Spec file</dt><dd><code>{record.path}</code></dd></div>
          </dl>
          <h3>Parent</h3>
          {record.parent ? <RecordLink index={index} id={record.parent} /> : <p className="hint">None (top level).</p>}
          <h3>Children <span className="section-count">{children.length}</span></h3>
          {children.length === 0 ? <p className="hint">None.</p> : (
            <LongList
              label="Children"
              className="plain"
              items={children}
              itemKey={(c) => c.id}
              searchText={recordText}
              render={(c) => <><RecordLink index={index} id={c.id} /> <small className="meta">{kindLabel(index, c.kind)}</small></>}
            />
          )}
          <h3>Links out</h3>
          <LinkGroups index={index} links={index.outgoing.get(id) ?? []} direction="out" />
          <h3>Links in</h3>
          <LinkGroups index={index} links={index.incoming.get(id) ?? []} direction="in" />
        </aside>
      </div>
    </>
  );
}
