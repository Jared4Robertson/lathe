import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import type { TraceJourney } from '../../../../lathe/src/traceability/trace/read-model';
import { useProblems } from '../../checking/problems/reads';
import { useChanges, countsText, changesLatestFirst, type RecordChange } from '../../changes/changes';
import { CHANGE_LABEL } from '../../changes/ChangeDetails';
import { useLiveVersion } from '../../changes/marks';
import { checksSectionHref, panelHref } from '../../views/overlays';
import { addressOf, withStage } from '../../views/address';
import { Link } from '../../router';
import { type RecordIndex, type RecordSummary } from '../../exploring/record-summaries/record-index';
import { useProduct } from '../../product/product/reads';
import { useShortcutHint } from '../../shell/commands';
import { MetricTiles } from '../../specs/KeyMetrics';
import { coverageMetrics, gapsMetric, journeysProvedMetric, problemMetrics, productProblems, type MetricFigure } from '../../specs/metrics';
import { ToolPanelFrame } from '../../views/ToolPanel';
import { useJourneyProofs } from '../trace/reads';
import { needsAttention, testWords, type AttentionRow } from './attention';
import { useStageCounts } from './reads';
import { STAGES, stageTable, type StageCell, type StageRow, type StageTable } from './stages';
import { statusOf, type Status } from './status';
import './dashboard.css';

// The Dashboard (LA-V157): one product's health, pulled up by a shortcut and full-window over the stage, its focus kept
// underneath, at `?panel=dashboard`. The six tiles come first; its header says what the product is and what it is for; Status is the first tile
// of the six that is not complete (status.ts); Domains by stage and Journeys show the shape of what is built
// and proved; Changes and Needs attention lead to what moved and what to do next. Every figure is one product's, read
// through the aggregates' own queries, and a row or cell closes the Dashboard and goes there. On a phone it is a bottom
// sheet. Where each thing leads follows the health draft's table, recorded as this view's requirements. A figure not
// read yet shows as `…`, never as zero, and every area keeps its size while it is read.

interface DashboardProps {
  index: RecordIndex;
  product: RecordSummary;
  sheet: boolean;
  onClose: () => void;
}

const READING = '…';

/** The first sentence of a description, in plain text. */
export const firstSentence = (text: string): string => {
  const plain = text.replace(/[*_`]/g, '').trim();
  const found = /^(.+?[.!?])(\s|$)/s.exec(plain);
  return (found ? found[1] : plain.split('\n')[0]).replace(/\s+/g, ' ');
};

export function DashboardPanel({ index, product, sheet, onClose }: DashboardProps) {
  const id = product.id;
  useLiveVersion();
  const home = addressOf(id);
  const domains = `${home}#domains`;
  const pageRead = useProduct(id, index);
  const page = pageRead.state === 'read' && pageRead.answer.product.id === id ? pageRead.answer : null;
  const problemsRead = useProblems(id, index);
  const problems = problemsRead.state === 'read' && problemsRead.answer.product === id ? problemsRead.answer : null;
  const journeysRead = useJourneyProofs(id, index);
  const journeys = journeysRead.state === 'read' && journeysRead.answer.product === id ? journeysRead.answer.journeys : null;
  const covered = index.coverage.size > 0;
  const scopes = useMemo(() => (covered ? [...index.coverage.values()] : null), [covered, index.coverage]);
  const counts = useStageCounts(index);
  const table = useMemo(() => stageTable(index, counts, covered), [index, counts, covered]);

  const tiles = useMemo(() => {
    const list = problems ? productProblems(problems) : undefined;
    const [errors, warnings] = problemMetrics(list);
    const [designed, built, proved] = covered ? coverageMetrics(scopes!) : coverageMetrics([]).map((f) => ({ ...f, value: undefined, total: undefined, tone: undefined }));
    const shown: MetricFigure[] = [
      { ...errors, detail: warnings.value === undefined ? undefined : `${warnings.value} warning${warnings.value === 1 ? '' : 's'}` },
      { ...designed, to: domains },
      { ...built, to: domains },
      { ...proved, to: domains },
      journeysProvedMetric(journeys ?? undefined, withStage(home, 'trace')),
      gapsMetric(scopes ?? undefined, checksSectionHref('gaps')),
    ];
    return shown;
  }, [problems, journeys, covered, scopes, home, domains]);
  const status = statusOf(tiles);
  const figures = status?.rung ? tiles.map((t) => (t.key === status.rung ? { ...t, rung: true } : t)) : tiles;

  const shortcut = useShortcutHint('openDashboard');
  const head = shortcut.text ? <kbd className="dashboard-key">{shortcut.text}</kbd> : null;
  return (
    <ToolPanelFrame label="Dashboard" head={head} className="dashboard-panel" sheet={sheet} onClose={onClose} full>
      <div className="dashboard-body" data-reading={status ? undefined : 'true'}>
        <div>
          <MetricTiles figures={figures} />
          <p className="dashboard-how">Status is the first tile not complete, read left to right.</p>
        </div>
        <div className="dashboard-top">
          <Identity index={index} product={product} description={page?.product.description ?? null} outcomes={page?.outcomes ?? null} counts={page ? { domains: page.domains.length, journeys: index.children.get(id)?.filter((r) => r.kind === 'journey').length ?? 0, roles: page.roles.length, interfaces: page.interfaces.length } : null} />
          <StatusBox status={status} />
        </div>
        <div className="dashboard-columns">
          <DomainsByStage table={table} />
          <Journeys index={index} product={id} journeys={journeys} />
        </div>
        <div className="dashboard-bottom">
          <Changes />
          <Attention index={index} problems={problems ? productProblems(problems)! : null} questions={page?.questions ?? null} journeys={journeys} scopes={scopes} />
        </div>
      </div>
    </ToolPanelFrame>
  );
}

function Identity({ index, product, description, outcomes, counts }: { index: RecordIndex; product: RecordSummary; description: string | null; outcomes: readonly { id: string; title: string }[] | null; counts: { domains: number; journeys: number; roles: number; interfaces: number } | null }) {
  const home = addressOf(product.id);
  const listed = outcomes ?? (index.children.get(product.id) ?? []).filter((r) => r.kind === 'business_outcome');
  const count = (n: number | undefined, one: string, at: string) => <Link to={`${home}#${at}`}>{n === undefined ? READING : n} {one}{n === 1 ? '' : 's'}</Link>;
  return (
    <div className="dashboard-who">
      <h3 className="dashboard-name">{product.title} <code>{product.id}</code></h3>
      <p className="dashboard-lead">{description === null ? READING : firstSentence(description)}</p>
      <p className="dashboard-label">Outcomes</p>
      {listed.length === 0 && <p className="hint">No outcomes yet.</p>}
      <ul className="dashboard-chips">
        {listed.map((o) => <li key={o.id}><Link to={addressOf(o.id)} title={o.id}>{o.title}</Link></li>)}
      </ul>
      <p className="dashboard-facts">
        {count(counts?.domains, 'domain', 'domains')}{' · '}{count(counts?.journeys, 'journey', 'discovery')}{' · '}{count(counts?.roles, 'role', 'roles')}{' · '}{count(counts?.interfaces, 'interface', 'interfaces')}
      </p>
    </div>
  );
}

function StatusBox({ status }: { status: Status | null }) {
  return (
    <div className="dashboard-status" role="status">
      <p className="dashboard-label">Status</p>
      <p className="dashboard-verdict">{status ? status.text : 'Reading…'}</p>
      <p className="dashboard-short">
        {status?.short.map((c, i) => (
          <span key={c.text}>{i > 0 && ', '}{c.to ? <Link to={c.to}>{c.text}</Link> : c.text}</span>
        ))}
        {status && status.short.length > 0 && status.closing && '. '}
        {status?.closing ?? ' '}
      </p>
    </div>
  );
}

function Cell({ row, cell }: { row: StageRow; cell: StageCell }) {
  if (cell.records === undefined) return <td className="dashboard-cell"><span className="dashboard-cell-box"><span aria-hidden="true">{READING}</span></span></td>;
  if (cell.records === 0) return <td className="dashboard-cell is-none"><span className="dashboard-cell-box"><span aria-hidden="true">–</span><span className="sr-only">None</span></span></td>;
  // The link's name starts with its visible number; the mark of gaps and tests not automated yet is its own image beside the link, not part of it.
  const said = `${cell.records} record${cell.records === 1 ? '' : 's'}, ${cell.label}, ${row.shared ? 'Shared' : row.owner}`;
  const marks = cell.marks ?? 0;
  const style = { '--dashboard-heat': `${cell.heat}%` } as CSSProperties;
  return (
    <td className={`dashboard-cell stage-${cell.stage}`} style={style}>
      <Link className="dashboard-cell-box" to={addressOf(cell.key)} aria-label={said}>
        <span>{cell.records}</span>
      </Link>
      {marks > 0 && <span className="dashboard-mark" role="img" aria-label={`${marks} gap${marks === 1 ? '' : 's'} or test${marks === 1 ? '' : 's'} not automated yet`} title={`${marks} gaps or tests not automated yet here`}>{marks}</span>}
    </td>
  );
}

function DomainsByStage({ table }: { table: StageTable }) {
  const homeOf = (row: StageRow) => addressOf(row.owner);
  const sample = Math.max(0, ...table.rows.filter((r) => !r.shared).flatMap((r) => r.cells.map((c) => c.marks ?? 0)), ...(table.rows.some((r) => !r.shared && r.marks) ? [] : table.rows.flatMap((r) => r.cells.map((c) => c.marks ?? 0))));
  const none = table.rows.filter((r) => !r.shared && r.marks === 0).map((r) => r.owner);
  const total = table.gaps === undefined || table.notAutomated === undefined ? undefined : table.gaps + table.notAutomated;
  return (
    <section className="dashboard-section" aria-labelledby="dashboard-domains">
      <h3 id="dashboard-domains">Domains by stage <small>records by domain and stage; darker means more</small></h3>
      <div className="dashboard-table">
        <table className="dashboard-stages">
          <thead>
            <tr>
              <th scope="col">Domain</th>
              {STAGES.map((s) => (
                <th key={s.stage} scope="col" aria-label={s.label} title={s.label}>
                  <span className="dashboard-stage-full" aria-hidden="true">{s.label}</span>
                  <span className="dashboard-stage-short" aria-hidden="true">{s.short}</span>
                </th>
              ))}
              <th scope="col" className="dashboard-marks-col">Gaps and not automated yet</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.owner} data-owner={row.owner}>
                <th scope="row">
                  <Link to={homeOf(row)}>
                    {row.shared ? <strong>Shared</strong> : <><code>{row.owner}</code> <span className="dashboard-domain-name">{row.title}</span></>}
                  </Link>
                </th>
                {row.cells.map((cell) => <Cell key={cell.stage} row={row} cell={cell} />)}
                <td className="dashboard-marks-col">
                  {row.marks === undefined ? <span className="dashboard-zero">{READING}</span>
                    : row.marks === 0 ? <span className="dashboard-zero">0</span>
                      : <Link to={homeOf(row)} aria-label={`${row.shared ? 'Shared' : row.owner}: ${row.marks} gaps and tests not automated yet`}>{row.marks}</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dashboard-legend">
        {total === undefined ? ' ' : total === 0 ? 'No gaps and no tests not automated yet.' : (
          <>
            <span className="dashboard-mark" aria-hidden="true">{sample}</span> gaps and tests not automated yet in that part.{' '}
            <Link to={checksSectionHref(table.gaps ? 'gaps' : 'not-automated')}>{total} in all: {table.gaps} gaps, {table.notAutomated} tests not automated yet</Link>
            {none.length > 0 && <>. None in {none.join(', ')}</>}.
          </>
        )}
      </p>
    </section>
  );
}

function JourneyMarks({ journey, words }: { journey: TraceJourney; words: string }) {
  return (
    <span className="dashboard-marks" role="img" aria-label={`${journey.status.stepsProved} of ${journey.status.steps} steps proved, ${words}`}>
      {journey.steps.map((s) => <i key={s.id} className={s.proved ? 'is-proved' : undefined} />)}
      <i className={`is-test${journey.testProved ? ' is-proved' : ''}`} />
    </span>
  );
}

function Journeys({ index, product, journeys }: { index: RecordIndex; product: string; journeys: readonly TraceJourney[] | null }) {
  const records = (index.children.get(product) ?? []).filter((r) => r.kind === 'journey');
  return (
    <section className="dashboard-section" aria-labelledby="dashboard-journeys">
      <h3 id="dashboard-journeys">Journeys <small>one mark per step; the last is its journey test</small></h3>
      {records.length === 0 && <p className="hint">No journeys yet.</p>}
      <ul className="dashboard-list">
        {records.map((r) => {
          const journey = journeys?.find((j) => j.id === r.id) ?? null;
          const words = journey ? testWords(journey, journey.test ? index.byId.get(journey.test)?.testState : null) : '';
          return (
            <li key={r.id}>
              <Link className="dashboard-journey" to={addressOf(r.id)}>
                <span className="dashboard-title"><code>{r.id}</code> <strong>{r.title}</strong></span>
                {journey ? <JourneyMarks journey={journey} words={words} /> : <span className="dashboard-marks" aria-hidden="true" />}
                <span className="dashboard-detail">
                  {journey ? <>{journey.status.stepsProved} of {journey.status.steps} step{journey.status.steps === 1 ? '' : 's'} · {words}{journey.outcomes.length > 0 && ` · serves ${journey.outcomes.join(', ')}`}</> : READING}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Row({ children, detail, lead, to }: { children: ReactNode; detail?: string; lead: string; to: string }) {
  return (
    <li>
      <Link className="dashboard-row" to={to}>
        <span className="dashboard-title">{children}</span>
        {detail && <span className="dashboard-detail">{detail}</span>}
        <span className="dashboard-lead-to">{lead}</span>
      </Link>
    </li>
  );
}

function Changes() {
  const { changes, baseline, live } = useChanges();
  const ordered = useMemo(() => changesLatestFirst(changes, live), [changes, live]);
  const read = baseline.state === 'ok';
  const hrefOf = (c: RecordChange) => (c.change === 'removed' ? panelHref('changes') : addressOf(c.id));
  return (
    <section className="dashboard-section" aria-labelledby="dashboard-changes">
      <h3 id="dashboard-changes">Changes <small>{read ? `${countsText(changes)} ${baseline.label}` : baseline.state === 'loading' ? READING : null}</small></h3>
      <ul className="dashboard-list dashboard-rows">
        {baseline.state === 'loading' && <li className="hint" role="status">Reading the baseline…</li>}
        {baseline.state === 'none' && <li className="hint">{baseline.message}</li>}
        {read && ordered.length === 0 && <li className="hint">Nothing has changed {baseline.label}.</li>}
        {read && ordered.slice(0, 3).map((c) => (
          <Row key={c.id} to={hrefOf(c)} lead="Record">
            <span className={`dashboard-change is-${c.change}`}>{CHANGE_LABEL[c.change]}</span> <code>{c.id}</code> {c.title}
          </Row>
        ))}
      </ul>
      <p className="dashboard-foot"><Link to={panelHref('changes')}>{read && changes.length > 0 ? `All ${changes.length} in Changes` : 'Open Changes'}</Link></p>
    </section>
  );
}

function Attention({ index, problems, questions, journeys, scopes }: { index: RecordIndex; problems: Parameters<typeof needsAttention>[1] | null; questions: Parameters<typeof needsAttention>[2] | null; journeys: readonly TraceJourney[] | null; scopes: Parameters<typeof needsAttention>[4] | null }) {
  const rows: AttentionRow[] | null = problems && questions && journeys && scopes ? needsAttention(index, problems, questions, journeys, scopes) : null;
  return (
    <section className="dashboard-section" aria-labelledby="dashboard-attention">
      <h3 id="dashboard-attention">Needs attention <small>the top few</small></h3>
      <ul className="dashboard-list dashboard-rows">
        {rows === null && <li className="hint" role="status">Reading…</li>}
        {rows?.length === 0 && <li className="hint">Nothing needs attention in {index.byId.get(index.product)?.title ?? index.product}.</li>}
        {rows?.map((r) => (
          <Row key={r.id} to={r.to} detail={r.detail} lead={r.lead}><code>{r.id}</code> <strong>{r.title}</strong></Row>
        ))}
      </ul>
      <p className="dashboard-foot"><Link to={panelHref('checks')}>All of it in Checks</Link></p>
    </section>
  );
}
