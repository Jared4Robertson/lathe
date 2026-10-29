// The wiki page of a domain, which the wiki card shows, and the stage sections a domain's and a product's pages share.
import { useState, type ReactNode } from 'react';
import { Link } from '../router';
import { RecordText } from './RecordText';
import { DomainPatterns } from './PatternParts';
import { patternsFollowedBy } from './patterns';
import { CoverageBars } from './ProductHealth';
import { LongList } from '../components/LongList';
import { ProblemList, RecordLink, RecordTree, Section, StageMark, gapText, idText, levelBelow, recordText, type SectionLevel } from './parts';
import { allFolders, domainFolders, foldedChildren, type Folder, type OwnerFolders, type StageFolders } from './folders';
import { ActionsSlotContext } from '../components/ActionsSlot';
import {
  byIdOrder,
  kindLabel,
  textOf,
  type SpecIndex,
  type SpecRecord,
  type SpecState,
} from './data';
import { HOME_PATH } from '../views/address';

// The wiki content of a domain, which the wiki card (app/src/views) shows over the stage; and what an address that is
// no page says.

// ---------- Shared pieces ----------

const recordsIn = (index: SpecIndex, predicate: (r: SpecRecord) => boolean) => index.workspace.records.filter(predicate).sort(byIdOrder);

// ---------- Pages ----------

/** An address that is no page, or the specs while they load or failed to. */
export function SpecView({ spec }: { spec: SpecState }) {
  const { index } = spec;
  return (
    <main className="spec-page panel" id="main">
      {spec.error && index && <p className="error">Couldn't reload the specs: {spec.error}</p>}
      {index ? <NotFound what="page" /> : <div className="placeholder"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Loading specs…'}</p></div>}
    </main>
  );
}

export function NotFound({ what, id }: { what: string; id?: string }) {
  return (
    <div className="placeholder">
      <p>{id ? <>There's no {what} with the ID <code>{id}</code>.</> : `There's no such ${what}.`} <Link to={HOME_PATH}>See all products</Link>.</p>
    </div>
  );
}

/** The problems in a product's or a domain's records. */
export const problemsUnder = (index: SpecIndex, key: 'product' | 'domain', id: string) =>
  index.workspace.problems.filter((p) => p.record && index.byId.get(p.record)?.[key] === id);

function QuestionList({ index, questions }: { index: SpecIndex; questions: SpecRecord[] }) {
  if (questions.length === 0) return <p className="hint">No open questions.</p>;
  return (
    <LongList
      label="Open questions"
      className="record-list"
      items={questions}
      itemKey={(q) => q.id}
      searchText={recordText}
      render={(q) => (
        <>
          <RecordLink index={index} id={q.id} row />
          <small className="meta">
            {textOf(q.row, 'owner') && <>owner {textOf(q.row, 'owner')}</>}
            {(index.outgoing.get(q.id) ?? []).filter((l) => l.relation === 'about').map((l) => (
              <span key={l.target}> · about <RecordLink index={index} id={l.target} showTitle={false} /></span>
            ))}
          </small>
        </>
      )}
    />
  );
}

/**
 * A stage on a domain or product page: its heading in its stage's color with its count, and beside it the actions of
 * what it lists itself (the Expand all of a stage with one folder, whose records it shows directly), then its contents.
 */
function StageBlock({ stage, level, children }: { stage: StageFolders; level: 2 | 3; children: ReactNode }) {
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  const StageHeading = level === 2 ? 'h2' : 'h3';
  return (
    <div className={`stage stage-${stage.stage}`}>
      <header className="stage-head">
        <StageHeading className="stage-title"><StageMark stage={stage.stage} />{stage.label}<span className="section-count">{stage.count}</span></StageHeading>
        <div className="spec-section-actions" ref={setActions} />
      </header>
      <ActionsSlotContext.Provider value={actions}>{children}</ActionsSlotContext.Provider>
    </div>
  );
}

/**
 * A domain's or a product's records in its stages, as the side nav reads them: each stage under its
 * heading and color (Domain model, Use cases, Interaction design, Technical specification, Test plan),
 * and in it one section per kind with records (or, for a stage with one folder, its records directly), each record a
 * row whose children of the same stage fold under it. A stage with nothing yet says so. Then the folders outside the stages, except open
 * questions, which the page lists itself.
 */
export function StageSections({ index, folders, query, level = 2 }: { index: SpecIndex; folders: OwnerFolders; query: string; level?: 2 | 3 }) {
  const q = query.trim().toLowerCase();
  const matches = (r: SpecRecord) => !q || recordText(r).toLowerCase().includes(q);
  const nested = (r: SpecRecord) => foldedChildren(index, r);
  const tree = (records: SpecRecord[], label: string) => {
    // A row shows when it, or anything folded under it at any depth, matches.
    const deep = (r: SpecRecord): boolean => matches(r) || nested(r).some(deep);
    const visible = records.filter(deep).length;
    return visible === 0 ? <p className="hint">Nothing matches.</p> : <RecordTree index={index} records={records} label={label} query={query} nested={nested} />;
  };
  const folderSection = (folder: Folder, at: SectionLevel) => (
    <Section key={folder.key} level={at} title={folder.label} count={folder.count} className="folder">
      {tree(folder.records, folder.label)}
    </Section>
  );
  return (
    <>
      {folders.stages.map((stage) => (
        <StageBlock key={stage.key} stage={stage} level={level}>
          {stage.count === 0 ? <p className="hint">Nothing yet.</p>
            : stage.direct ? tree(stage.direct.records, stage.direct.label)
            : stage.folders.filter((f) => f.count > 0).map((f) => folderSection(f, levelBelow(level)))}
        </StageBlock>
      ))}
      {folders.loose.filter((f) => f.kind !== 'question').map((f) => folderSection(f, level))}
    </>
  );
}

/**
 * A domain's wiki, read in the same stages and folders as the side nav (StageSections), then the
 * patterns the domain follows, its open questions, coverage and problems.
 */
export function DomainWiki({ index, id }: { index: SpecIndex; id: string }) {
  const [query, setQuery] = useState('');
  const domain = index.byId.get(id)!;
  const q = query.trim().toLowerCase();
  const matches = (r: SpecRecord) => !q || recordText(r).toLowerCase().includes(q);
  const problems = problemsUnder(index, 'domain', id);

  const folders = domainFolders(index, id);
  // Records of the domain that no folder lists and that no listed record folds (misplaced).
  const shown = new Set<string>();
  const walk = (r: SpecRecord) => {
    if (shown.has(r.id)) return;
    shown.add(r.id);
    for (const c of foldedChildren(index, r)) walk(c);
  };
  allFolders(folders).forEach((f) => f.records.forEach(walk));
  const others = recordsIn(index, (r) => r.domain === id && r.id !== id && !shown.has(r.id) && matches(r));
  const questions = folders.loose.find((f) => f.kind === 'question')?.records ?? [];

  return (
    <div className="spec-body">
      <RecordText index={index} record={domain} />
      <div className="search">
        <label htmlFor="record-search">Filter records</label>
        <input id="record-search" type="search" value={query} placeholder="ID or title" onChange={(e) => setQuery(e.target.value)} />
      </div>
      <StageSections index={index} folders={folders} query={query} />
      <Section title="Patterns we follow" count={patternsFollowedBy(index, id).length}>
        <DomainPatterns index={index} domainId={id} query={query} />
      </Section>
      {others.length > 0 && (
        <Section title="Other records" count={others.length}>
          <RecordTree index={index} records={others} label="Other records" showKind />
        </Section>
      )}
      <Section title="Open questions" count={questions.length}>
        <QuestionList index={index} questions={questions.filter(matches)} />
      </Section>
      <Section title="Coverage">
        <CoverageBars coverage={index.coverage.get(id)} />
        {(index.coverage.get(id)?.gaps.length ?? 0) > 0 && (
          <LongList
            label="Coverage gaps"
            className="record-list gaps"
            items={index.coverage.get(id)!.gaps}
            itemKey={(g) => `${g.id}-${g.missing}`}
            searchText={(g) => idText(index, g.id)}
            render={(g) => (
              <>
                <RecordLink index={index} id={g.id} row />
                <small className="meta" title={g.message}>{kindLabel(index, g.kind)} {gapText(g.missing)}</small>
              </>
            )}
          />
        )}
      </Section>
      <Section title="Problems in this domain" count={problems.length}>
        <ProblemList index={index} problems={problems} />
      </Section>
    </div>
  );
}
