import { forwardRef, memo, type CSSProperties, type ReactNode, type UIEvent } from 'react';
import { Breadcrumb } from '../shell/Breadcrumb';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { pageOf } from '../record/pages';
import { groupKindLabel, groupLabel, groupMembers, groupName, groupOwner, stageFor } from '../graph/model';
import { treeGroup } from '../graph/tree';
import { Link } from '../router';
import { FormatPageView } from '../format/FormatPages';
import { kindPagePath, type FormatRoute } from '../format/reference';
import { pageHref } from './overlays';
import { HistorySection } from './RecordHistory';
import { Tooltip } from '../shell/Tooltip';
import { kindLabel, type ListedProblem, type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';
import { foldedChildren } from '../exploring/folder-tree/folders';
import { Markdown } from '../specs/Markdown';
import { ProblemBadge, RecordTree, Section, listTitle } from '../specs/parts';
import { RecordFacts } from '../specs/RecordContent';
import { problemsUnder } from '../specs/SpecPages';
import { ProductPage } from '../authoring/product/ProductPage';
import { DomainPage } from '../authoring/domain/DomainPage';
import { addressOf, focusOf, type FocusRoute } from './address';
import { focusTrail } from './HeaderStrip';
import { CardChanges } from '../changes/CardChanges';

// The wiki card (LA-V96): the one card, the focused record's or group's wiki page, with its editing,
// floating over the right of the open space above whichever stage shows, in one constant spot just under the stage's toolbar row, its height a steady share of
// the stage (the stylesheet's). It reads as part of the graph: the boxes' kind line and a stripe in the
// focused box's own color along its top, with round corners, a hairline border and a shadow that set it
// off the map. It opens as a summary (the kind line, the title, the whole lead text and up to
// three key facts); More shows the whole wiki page in place and Less goes back, the session's setting
// like its open state and width (graph/settings.ts). It follows the focus once the focus settles
// (FocusPage.tsx), cross-fading to the new page, so arrowing through the stage never draws a page per
// step, and it is memoized, so nothing but a new page or a new index draws it again. A link in it
// moves the focus, as a click on the stage does. It is resizable and collapsible by its button and
// the w key. On a phone it is a bottom sheet.
//
// A format page (the record format, a kind's or a check's page) opens in it too, over the focus
// (`?page=format/kinds/use_case`, overlays.ts): the whole page, with a link back to the focus, the
// stage keeping its focus behind it (LA-PAT-APP-UX-R20).

/**
 * The cross-fade never leaves a page faint: a hidden window pauses its animations, so a page drawn while the window is
 * hidden, or hidden mid-fade, ends its fade at once and shows whole.
 */
export function settleWhenHidden(page: HTMLElement | null) {
  if (!page) return;
  const settle = () => { if (document.hidden) for (const a of page.getAnimations?.() ?? []) a.finish(); };
  settle();
  document.addEventListener('visibilitychange', settle);
  return () => document.removeEventListener('visibilitychange', settle);
}

export interface WikiCardProps {
  index: RecordIndex;
  /** The page it shows: the focus, once settled. */
  route: FocusRoute;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
  onCollapse: () => void;
  /** The whole wiki page (More), or the summary (Less). */
  expanded: boolean;
  onExpanded: (expanded: boolean) => void;
  /** In a bottom sheet on a phone. */
  sheet?: boolean;
  /** The resize handle at its left edge, on a wide screen. */
  handle?: ReactNode;
  /** A format page shown over the focus's page, or null. */
  format?: FormatRoute | null;
}

export const WikiCard = memo(forwardRef<HTMLDivElement, WikiCardProps>(function WikiCard({ index, route, onScroll, onCollapse, expanded, onExpanded, sheet = false, handle, format = null }, scroller) {
  const focus = focusOf(route);
  if (format) return <FormatCard ref={scroller} index={index} focus={focus} format={format} onScroll={onScroll} onCollapse={onCollapse} sheet={sheet} handle={handle} />;
  const trail = focusTrail(index, focus);
  const record = index.byId.get(focus);
  // The stripe takes the focused box's own color: its stage's edge, as the graph draws it.
  const accent = { '--card-accent': `var(--g-${stageFor(index, focus, record?.kind ?? '')})` } as CSSProperties;
  const moreLabel = expanded ? 'Show the summary' : 'Show the whole wiki page';
  return (
    <section
      aria-label="Wiki card"
      className={`wiki-panel${sheet ? ' is-sheet' : ''}${expanded ? ' is-expanded' : ''}`}
      data-floating={sheet ? undefined : 'right'}
      data-page={focus}
      style={accent}
    >
      <div className="wiki-panel-head">
        {trail.length > 0 ? <Breadcrumb items={trail} label="Wiki card breadcrumb" className="wiki-panel-trail" /> : <span className="wiki-panel-trail" />}
        <Tooltip label={moreLabel} placement="left">
          <Button className="wiki-panel-more" aria-expanded={expanded} onClick={() => onExpanded(!expanded)}>{expanded ? 'Less' : 'More'}</Button>
        </Tooltip>
        <Tooltip label="Collapse the wiki card" command="toggleWikiCard" placement="left">
          <Button variant="icon" label="Collapse the wiki card" className="wiki-panel-collapse" onClick={onCollapse}>
            <Icon name={sheet ? 'x' : 'sidebar-right'} size={16} />
          </Button>
        </Tooltip>
      </div>
      <div className="wiki-panel-scroll" ref={scroller} onScroll={onScroll}>
        {/* A new page cross-fades in (none under reduced motion, the stylesheet's). */}
        <div key={focus} ref={settleWhenHidden} className="wiki-panel-page">
          <CardTitle index={index} route={route} />
          {expanded ? <WikiContent index={index} route={route} /> : <CardSummary index={index} route={route} />}
        </div>
      </div>
      {handle}
    </section>
  );
}));

interface FormatCardProps {
  index: RecordIndex;
  focus: string;
  format: FormatRoute;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
  onCollapse: () => void;
  sheet: boolean;
  handle?: ReactNode;
}

/** The card showing a format page over the focus: the whole page, and a link back to the focus's. */
const FormatCard = forwardRef<HTMLDivElement, FormatCardProps>(function FormatCard({ index, focus, format, onScroll, onCollapse, sheet, handle }, scroller) {
  const record = index.byId.get(focus);
  const name = record ? `${focus} ${record.title}` : groupLabel(index, focus);
  return (
    <section
      aria-label="Wiki card"
      className={`wiki-panel is-expanded is-format${sheet ? ' is-sheet' : ''}`}
      data-floating={sheet ? undefined : 'right'}
      data-page={`format ${JSON.stringify(format)}`}
    >
      <div className="wiki-panel-head">
        <Link to={pageHref(null)} className="wiki-panel-back" title={`Back to ${name}`}>
          <Icon name="chevron-right" size={14} /> <span>Back to {record ? <code>{focus}</code> : name}</span>
        </Link>
        <Tooltip label="Collapse the wiki card" command="toggleWikiCard" placement="left">
          <Button variant="icon" label="Collapse the wiki card" className="wiki-panel-collapse" onClick={onCollapse}>
            <Icon name={sheet ? 'x' : 'sidebar-right'} size={16} />
          </Button>
        </Tooltip>
      </div>
      <div className="wiki-panel-scroll" ref={scroller} onScroll={onScroll}>
        <div key={JSON.stringify(format)} ref={settleWhenHidden} className="wiki-panel-page">
          <FormatPageView index={index} route={format} />
        </div>
      </div>
      {handle}
    </section>
  );
});

/** The card's title: the box's kind line (the kind and the ID), the title and the problems. The page's h1 is the header strip's. */
function CardTitle({ index, route }: { index: RecordIndex; route: FocusRoute }) {
  const focus = focusOf(route);
  const record = index.byId.get(focus);
  let problems: ListedProblem[];
  if (route.page === 'product') problems = problemsUnder(index, 'product', focus);
  else if (route.page === 'domain') problems = problemsUnder(index, 'domain', focus);
  else if (record) problems = index.problemsFor.get(focus) ?? [];
  else problems = groupMembers(index, focus).flatMap((m) => index.problemsFor.get(m.id) ?? []);
  return (
    <header className="wiki-panel-title spec-header">
      <div>
        <p className="wiki-panel-kind">
          {record ? kindLabel(index, record.kind) : groupKindLabel(index, focus)}
          {record && <> · <Link to={addressOf(focus)} className="record-link"><code>{focus}</code></Link></>}
        </p>
        <h2>{record?.title ?? groupLabel(index, focus)}</h2>
      </div>
      <ProblemBadge problems={problems} />
    </header>
  );
}


/**
 * The summary: the whole lead text and the key facts. Edit and Add stay in reach, as on the whole page.
 */
function CardSummary({ index, route }: { index: RecordIndex; route: FocusRoute }) {
  const focus = focusOf(route);
  const record = index.byId.get(focus);
  if (!record) {
    const kind = treeGroup(index, focus)?.kind;
    const description = kind ? index.meta.kinds.get(kind)?.description : undefined;
    const members = groupMembers(index, focus);
    return (
      <div className="spec-body wiki-panel-summary">
        {description && <div className="wiki-panel-lead"><Markdown source={description} /></div>}
        <dl className="fields"><div><dt>{listTitle(index, members, 'Members')}</dt><dd>{members.length}</dd></div></dl>
      </div>
    );
  }
  // Every kind's aggregate draws its own summary, with its own actions.
  const Page = pageOf(index.meta, record.kind);
  if (Page) return <Page key={focus} index={index} id={focus} summary after={<CardChanges index={index} id={focus} summary />} />;
  return <NoPage kind={record.kind} />;
}

/** What the card says for a record of a kind no aggregate knows (a kind removed from the schema while its rows remain). */
function NoPage({ kind }: { kind: string }) {
  return <div className="spec-body placeholder"><p>No aggregate has a page for the kind <code>{kind}</code>.</p></div>;
}

/** The whole wiki page (More): a record's page ends with its History (LA-V102-R05), read only when asked. */
function WikiContent({ index, route }: { index: RecordIndex; route: FocusRoute }) {
  if (route.page === 'group') return <GroupWiki index={index} gid={focusOf(route)} />;
  return (
    <>
      <WikiPage index={index} route={route} />
      <div className="spec-body"><CardChanges index={index} id={focusOf(route)} /><HistorySection index={index} id={focusOf(route)} /></div>
    </>
  );
}

function WikiPage({ index, route }: { index: RecordIndex; route: Exclude<FocusRoute, { page: 'group' }> }) {
  switch (route.page) {
    case 'product': return <ProductPage key={route.product} index={index} id={route.product} after={<OwnFacts index={index} id={route.product} />} />;
    case 'domain': return <DomainPage key={route.domain} index={index} id={route.domain} after={<OwnFacts index={index} id={route.domain} />} />;
    case 'record': {
      // Every kind's aggregate draws its own page.
      const kind = index.byId.get(route.id)?.kind ?? '';
      const Page = pageOf(index.meta, kind);
      return Page ? <Page key={route.id} index={index} id={route.id} /> : <NoPage kind={kind} />;
    }
  }
}

/** A product's or a domain's facts after its page, as a record's follow its body (RecordContent): its kind, data file and links both ways. */
function OwnFacts({ index, id }: { index: RecordIndex; id: string }) {
  const record = index.byId.get(id);
  if (!record) return null;
  return <div className="spec-body"><aside className="record-side" aria-label="Facts"><RecordFacts index={index} record={record} /></aside></div>;
}

/** A group's wiki page: its parent, its kind, and its members, each with its coverage marks and its own children folded. */
function GroupWiki({ index, gid }: { index: RecordIndex; gid: string }) {
  const parent = groupOwner(index, gid);
  const kind = treeGroup(index, gid)?.kind;
  const members = groupMembers(index, gid);
  const parentRecord = index.byId.get(parent)!;
  const group = treeGroup(index, gid);
  const stage = group?.role === 'stage' ? index.meta.stages.find((s) => groupName(index, gid) === s.label) : undefined;
  const description = kind ? index.meta.kinds.get(kind)?.description : stage?.description;
  // In a stage or its folders, a row folds only what is of its own stage, as in the nav; under a record, all its children.
  const nested = group?.role === 'kind' && index.byId.has(parent) && parentRecord.kind !== 'product' && parentRecord.kind !== 'domain' ? undefined : (r: RecordSummary) => foldedChildren(index, r);
  // A list of one kind is titled by that kind ("Use cases", "Commands"); a mixed one stays "Members".
  const membersTitle = listTitle(index, members, 'Members');
  const kinds = [...new Set(members.map((m) => m.kind))];
  return (
    <div className="spec-body">
      <p className="group-intro">
        {groupName(index, gid)} of <Link to={addressOf(parent)} className="record-link"><code>{parent}</code> <span>{parentRecord.title}</span></Link>
      </p>
      {kind && (
        <dl className="fields">
          <div><dt>Kind</dt><dd title={index.meta.kinds.get(kind)?.description}><Link to={kindPagePath(kind)}>{kindLabel(index, kind)}</Link></dd></div>
        </dl>
      )}
      {description && <Markdown source={description} />}
      {/* A stage lists its folders, one section per kind. */}
      {kinds.length > 1 ? kinds.map((k) => {
        const records = members.filter((m) => m.kind === k);
        const title = listTitle(index, records, 'Members');
        return (
          <Section key={k} title={title} count={records.length}>
            <RecordTree index={index} records={records} label={`${title} of ${gid}`} nested={nested} />
          </Section>
        );
      }) : (
        <Section title={membersTitle} count={members.length}>
          <RecordTree index={index} records={members} label={`${membersTitle} of ${gid}`} nested={nested} />
        </Section>
      )}
    </div>
  );
}
