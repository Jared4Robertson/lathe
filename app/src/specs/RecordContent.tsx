import { lowerLabel } from '../plural';
import type { ReactNode } from 'react';
import { type RecordIndex, type RecordSummary, type SummaryLink } from '../exploring/record-summaries/record-index';
import { addressOf } from '../views/address';
import { groupByLabel } from './labels';
import { Traceability } from './Traceability';
import { kindPagePath } from '../format/reference';
import { LongList } from '../components/LongList';
import { DesktopRecordActions } from '../shell/desktopRecord';
import { KindBadge, StageFact, ProblemList, RecordLink, Section, SpecLink, TestStateTag, idText, isTestKind, notAutomatedYet } from './parts';

// What every record's page holds around its aggregate's own content (the Record page pattern, LA-PAT-RECORD-PAGE):
// the eyebrow, its Traceability, its problems, and its facts (kind, stage, a test's state, why it has no parent, its
// data file) and links both ways, all from the space's record summaries and the Record trace read. The page's own
// fields are its aggregate's (each aggregate's page in app/src/<domain>/<aggregate>/), never read here by column.

/** A record's links one way, grouped and named by their labels read from this record (LA-PAT-RECORD-PAGE-R07). */
function LinkGroups({ index, links, direction }: { index: RecordIndex; links: SummaryLink[]; direction: 'out' | 'in' }) {
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

/** The eyebrow over a record's title: its product and its domain as links, and its kind as a badge in its stage's color. */
export function RecordEyebrow({ index, record }: { index: RecordIndex; record: RecordSummary }) {
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

/**
 * What every record's page holds around its own content (the Record page pattern): a test's note when it is not
 * automated yet, then the page's content, its Traceability, what comes `after` it (its children), and its problems;
 * its facts and links both ways beside them. An aggregate's page draws its own content inside it.
 */
export function RecordFrame({ index, record, skip, after, children }: { index: RecordIndex; record: RecordSummary; skip?: ReadonlySet<string>; after?: ReactNode; children: ReactNode }) {
  const problems = index.problemsFor.get(record.id) ?? [];
  return (
    <div className="record-layout">
      <div className="record-main">
        {isTestKind(index, record.kind) && notAutomatedYet(record) && (
          <p className="not-automated-note" role="note">
            <strong>Not automated yet.</strong> No file runs it, so it does not count as proof of what it proves.
          </p>
        )}
        {children}
        {/* After the body and its kind's own sections, before the children. */}
        <Traceability index={index} record={record} skip={skip} />
        {after}
        <Section title="Problems" count={problems.length}>
          <ProblemList index={index} problems={problems} showRecord={false} />
        </Section>
      </div>
      {/* The record's facts after the body: its kind, fields, data file and links both ways. */}
      <aside className="record-side" aria-label="Facts"><RecordFacts index={index} record={record} /></aside>
    </div>
  );
}

/**
 * Why a record has no parent: a product is the top; a kind with no owner exists because other records use it, and
 * belongs to the domain its ID names (a specification), to the one domain that uses it, or else is shared.
 */
export function parentlessText(index: RecordIndex, record: RecordSummary): string {
  if (record.kind === 'product') return 'None (top level).';
  const kind = index.meta.kinds.get(record.kind);
  if ((kind?.parent_kinds.length ?? 0) > 0) return 'None (its parent is missing).';
  const domain = record.domain ? index.byId.get(record.domain)?.title ?? record.domain : null;
  if (kind?.id_scope === 'domain') return `None: it has no owner. It belongs to the domain its ID names${domain ? `, ${domain}` : ''}.`;
  return domain
    ? `None: it has no owner. It belongs to ${domain}, the one domain that uses it.`
    : 'None: it has no owner. It is shared: two or more domains use it, or none.';
}

/**
 * A record's facts: kind, stage, short fields, data file and line, and its links both ways. Shown after the body, in the wiki card's whole page.
 */
export function RecordFacts({ index, record }: { index: RecordIndex; record: RecordSummary }) {
  const { id } = record;
  const kind = index.meta.kinds.get(record.kind);
  const isTest = isTestKind(index, record.kind);
  // A test's state gets its own row, with its tag.
  return (
    <>
      <dl className="fields">
        <div><dt>Kind</dt><dd title={kind?.description}><SpecLink to={kindPagePath(record.kind)} title={`How a ${lowerLabel(kind?.label ?? record.kind)} works`}>{kind?.label ?? record.kind}</SpecLink></dd></div>
        <StageFact index={index} kind={record.kind} />
        {isTest && <div><dt>State</dt><dd><TestStateTag record={record} /></dd></div>}
        {/* Why a record has no parent; one that has one is named by the card's breadcrumb. */}
        {!record.parent && <div><dt>Parent</dt><dd>{parentlessText(index, record)}</dd></div>}
        <div><dt>Data file</dt><dd><code>{record.file}:{record.line}</code><DesktopRecordActions id={id} /></dd></div>
      </dl>
      <h3>Links out</h3>
      <LinkGroups index={index} links={index.outgoing.get(id) ?? []} direction="out" />
      <h3 id={`links-in-${id}`} tabIndex={-1} className="links-in-heading">Links in</h3>
      <LinkGroups index={index} links={index.incoming.get(id) ?? []} direction="in" />
    </>
  );
}
