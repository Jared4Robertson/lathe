import { forwardRef, memo, type ReactNode, type UIEvent } from 'react';
import { Breadcrumb } from '../shell/Breadcrumb';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { Editable } from '../edit/Editing';
import { groupLabel, groupMembers, groupName, groupOwner } from '../graph/model';
import { treeGroup } from '../graph/tree';
import { Link } from '../router';
import { Tooltip } from '../shell/Tooltip';
import type { Problem, SpecIndex, SpecRecord } from '../specs/data';
import { foldedChildren } from '../specs/folders';
import { Markdown } from '../specs/Markdown';
import { KindBadge, ProblemBadge, RecordTree, Section, listTitle } from '../specs/parts';
import { RecordContent } from '../specs/RecordContent';
import { DomainWiki, ProductWiki, problemsUnder } from '../specs/SpecPages';
import { addressOf, focusOf, type FocusRoute } from './address';
import { focusTrail } from './HeaderStrip';

// The wiki card (LA-V96): the one card, the focused record's or group's whole wiki page, with its
// editing, floating over the left of the open space above whichever stage shows. It follows the
// focus once the focus settles (FocusPage.tsx), so arrowing through the stage never draws a page
// per step, and it is memoized, so nothing but a new page or a new index draws it again. A link in
// it moves the focus, as a click on the stage does. It is resizable, collapsible by its button and
// the w key, and its open state and width are the session's setting (graph/settings.ts). On a
// phone it is a bottom sheet.

export interface WikiCardProps {
  index: SpecIndex;
  /** The page it shows: the focus, once settled. */
  route: FocusRoute;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
  onCollapse: () => void;
  /** In a bottom sheet on a phone. */
  sheet?: boolean;
  /** The resize handle at its right edge, on a wide screen. */
  handle?: ReactNode;
}

export const WikiCard = memo(forwardRef<HTMLDivElement, WikiCardProps>(function WikiCard({ index, route, onScroll, onCollapse, sheet = false, handle }, scroller) {
  const focus = focusOf(route);
  const trail = focusTrail(index, focus);
  return (
    <section aria-label="Wiki card" className={`wiki-panel${sheet ? ' is-sheet' : ''}`} data-floating={sheet ? undefined : 'left'} data-page={focus}>
      <div className="wiki-panel-head">
        {trail.length > 0 ? <Breadcrumb items={trail} label="Wiki card breadcrumb" className="wiki-panel-trail" /> : <span className="wiki-panel-trail" />}
        <Tooltip label="Collapse the wiki card" command="toggleWikiCard" placement="left">
          <Button variant="icon" label="Collapse the wiki card" className="wiki-panel-collapse" onClick={onCollapse}>
            <Icon name={sheet ? 'x' : 'sidebar-left'} size={16} />
          </Button>
        </Tooltip>
      </div>
      <div className="wiki-panel-scroll" ref={scroller} onScroll={onScroll}>
        <CardTitle key={focus} index={index} route={route} />
        <WikiContent index={index} route={route} />
      </div>
      {handle}
    </section>
  );
}));

/** The card's title: the kind, the title, the ID and the problems. The page's h1 is the header strip's. */
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
        <p className="eyebrow">{record ? <KindBadge index={index} kind={record.kind} /> : 'Group'}</p>
        <h2>{record?.title ?? groupLabel(index, focus)}</h2>
        {record && <p className="record-id"><Link to={addressOf(focus)} className="record-link"><code>{focus}</code></Link></p>}
      </div>
      <ProblemBadge problems={problems} />
    </header>
  );
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
