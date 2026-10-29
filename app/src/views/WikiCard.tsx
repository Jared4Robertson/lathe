import { forwardRef, memo, type CSSProperties, type ReactNode, type UIEvent } from 'react';
import { Breadcrumb } from '../shell/Breadcrumb';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { Editable } from '../edit/Editing';
import { groupKindLabel, groupLabel, groupMembers, groupName, groupOwner, stageFor } from '../graph/model';
import { treeGroup } from '../graph/tree';
import { Link } from '../router';
import { Tooltip } from '../shell/Tooltip';
import { gapsOf, kindLabel, type Problem, type SpecIndex, type SpecRecord } from '../specs/data';
import { foldedChildren } from '../specs/folders';
import { Markdown } from '../specs/Markdown';
import { gapText, ProblemBadge, RecordLink, RecordTree, Section, listTitle } from '../specs/parts';
import { RecordContent } from '../specs/RecordContent';
import { factsOf, leadOf } from '../specs/RecordText';
import { DomainWiki, ProductWiki, problemsUnder } from '../specs/SpecPages';
import { addressOf, focusOf, type FocusRoute } from './address';
import { focusTrail } from './HeaderStrip';

// The wiki card (LA-V96): the one card, the focused record's or group's wiki page, with its editing,
// floating over the right of the open space above whichever stage shows, between the open space and
// the side bar, in one constant spot just under the stage's toolbar row, its height a steady share of
// the stage (the stylesheet's). It reads as part of the graph: the boxes' kind line and a stripe in the
// focused box's own color along its top, with round corners, a hairline border and a shadow that set it
// off the map. It opens as a summary (the kind line, the title, the lead text clamped to a few lines and up to
// three key facts); More shows the whole wiki page in place and Less goes back, the session's setting
// like its open state and width (graph/settings.ts). It follows the focus once the focus settles
// (FocusPage.tsx), cross-fading to the new page, so arrowing through the stage never draws a page per
// step, and it is memoized, so nothing but a new page or a new index draws it again. A link in it
// moves the focus, as a click on the stage does. It is resizable and collapsible by its button and
// the w key. On a phone it is a bottom sheet.

export interface WikiCardProps {
  index: SpecIndex;
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
}

export const WikiCard = memo(forwardRef<HTMLDivElement, WikiCardProps>(function WikiCard({ index, route, onScroll, onCollapse, expanded, onExpanded, sheet = false, handle }, scroller) {
  const focus = focusOf(route);
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
        <div key={focus} className="wiki-panel-page">
          <CardTitle index={index} route={route} />
          {expanded ? <WikiContent index={index} route={route} /> : <CardSummary index={index} route={route} />}
        </div>
      </div>
      {handle}
    </section>
  );
}));

/** The card's title: the box's kind line (the kind and the ID), the title and the problems. The page's h1 is the header strip's. */
function CardTitle({ index, route }: { index: SpecIndex; route: FocusRoute }) {
  const focus = focusOf(route);
  const record = index.byId.get(focus);
  let problems: Problem[];
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

/** At most this many key facts in the summary. */
const SUMMARY_FACTS = 3;

/**
 * The summary: the lead text, clamped to a few lines, and the key facts. Edit and Add stay in reach, as on the whole page.
 */
function CardSummary({ index, route }: { index: SpecIndex; route: FocusRoute }) {
  const focus = focusOf(route);
  const record = index.byId.get(focus);
  if (!record) {
    const kind = treeGroup(index, focus)?.kind;
    const description = kind ? index.kinds.get(kind)?.description : undefined;
    const members = groupMembers(index, focus);
    return (
      <div className="spec-body wiki-panel-summary">
        {description && <div className="wiki-panel-lead"><Markdown source={description} /></div>}
        <dl className="fields"><div><dt>{listTitle(index, members, 'Members')}</dt><dd>{members.length}</dd></div></dl>
      </div>
    );
  }
  const lead = leadOf(record);
  return (
    <Editable key={focus} index={index} id={focus}>
      <div className="spec-body wiki-panel-summary">
        {lead && <div className="wiki-panel-lead"><Markdown source={lead} /></div>}
        <dl className="fields">
          {keyFacts(index, record).map((f, i) => <div key={`${i}-${f.label}`}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
        </dl>
      </div>
    </Editable>
  );
}

/** A record's key facts, at most SUMMARY_FACTS: its parent, an obligation's coverage, its kind's own short fields, then its children's count. */
function keyFacts(index: SpecIndex, record: SpecRecord): { label: string; value: ReactNode }[] {
  const out: { label: string; value: ReactNode }[] = [];
  const parent = record.parent ? index.byId.get(record.parent) : undefined;
  if (parent) out.push({ label: kindLabel(index, parent.kind), value: <RecordLink index={index} id={parent.id} /> });
  if (index.chains.has(record.id)) {
    const gaps = gapsOf(index, record.id);
    out.push({ label: 'Coverage', value: gaps.length === 0 ? 'designed, built and proved' : gaps.map(gapText).join(', ') });
  }
  for (const f of factsOf(index, record)) out.push({ label: f.label, value: f.value });
  const children = index.children.get(record.id) ?? [];
  const facts = out.slice(0, children.length > 0 ? SUMMARY_FACTS - 1 : SUMMARY_FACTS);
  if (children.length > 0) facts.push({ label: listTitle(index, children, 'Children'), value: children.length });
  return facts;
}

function WikiContent({ index, route }: { index: SpecIndex; route: FocusRoute }) {
  switch (route.page) {
    case 'product': return <Editable key={route.product} index={index} id={route.product}><ProductWiki index={index} id={route.product} /></Editable>;
    case 'domain': return <Editable key={route.domain} index={index} id={route.domain}><DomainWiki index={index} id={route.domain} /></Editable>;
    case 'record': return <Editable key={route.id} index={index} id={route.id}><div className="spec-body"><RecordContent index={index} id={route.id} header={false} side={false} /></div></Editable>;
    case 'group': return <GroupWiki index={index} gid={focusOf(route)} />;
  }
}

/** A group's wiki page: its parent, its kind, and its members, each with its coverage marks and its own children folded. */
function GroupWiki({ index, gid }: { index: SpecIndex; gid: string }) {
  const parent = groupOwner(index, gid);
  const kind = treeGroup(index, gid)?.kind;
  const members = groupMembers(index, gid);
  const parentRecord = index.byId.get(parent)!;
  const group = treeGroup(index, gid);
  const stage = group?.role === 'stage' ? index.workspace.stages.find((s) => groupName(index, gid) === s.label) : undefined;
  const description = kind ? index.kinds.get(kind)?.description : stage?.description;
  // In a stage or its folders, a row folds only what is of its own stage, as in the nav; under a record, all its children.
  const nested = group?.role === 'kind' && index.byId.has(parent) && parentRecord.kind !== 'product' && parentRecord.kind !== 'domain' ? undefined : (r: SpecRecord) => foldedChildren(index, r);
  // A list of one kind is titled by that kind ("Use cases", "Commands"); a mixed one stays "Members".
  const membersTitle = listTitle(index, members, 'Members');
  const kinds = [...new Set(members.map((m) => m.kind))];
  return (
    <div className="spec-body">
      <p className="group-intro">
        {groupName(index, gid)} of <Link to={addressOf(parent)} className="record-link"><code>{parent}</code> <span>{parentRecord.title}</span></Link>
      </p>
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
