import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { Button } from '../components/Button';
import { LongList } from '../components/LongList';
import { readMotion } from '../graph/motion';
import { FILE_KIND, groupLabel } from '../graph/model';
import { NodeLink, type GraphInfo } from '../graph/panel';
import { erdFor } from '../model/erd';
import { kindLabel, type SpecIndex } from '../specs/data';
import { listTitle } from '../specs/parts';
import type { SideMode } from './sideBarState';

// The side bar's Outline (LA-EXP-UC12-R04): what the main view holds, as rows to jump to.
// - Wiki: the page's sections and headings (Traceability and its groups, children, problems, the
//   body's Markdown headings), each a row that scrolls the wiki there, the section in view marked.
// - Graph: the records the camera frames, grouped by level from left to right.
// - Model: the boxes, those in focus first.
// Each list is rows that are clickable anywhere (LA-PAT-APP-UX-R05), searchable past 10 rows.

export interface SideBarOutlineProps {
  index: SpecIndex;
  focus: string;
  mode: SideMode;
  graph: GraphInfo | null;
  wikiPane: RefObject<HTMLDivElement | null>;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
}

export function SideBarOutline(props: SideBarOutlineProps) {
  if (props.mode === 'graph') return <GraphOutline {...props} />;
  if (props.mode === 'model') return <ModelOutline {...props} />;
  return <WikiOutline {...props} />;
}

// ---------- Wiki ----------

interface Heading { key: string; text: string; depth: number; el: HTMLElement }

/** A heading's own text, without its count. */
const headingText = (el: HTMLElement) =>
  [...el.childNodes].filter((n) => !(n instanceof Element && n.classList.contains('section-count'))).map((n) => n.textContent ?? '').join('').trim();

/** The wiki's headings, below the page's own title, in page order. */
export function wikiHeadings(pane: HTMLElement): Heading[] {
  const found = [...pane.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')].filter((el) => !el.closest('.pane-title, .spec-header'));
  const levels = found.map((el) => Number(el.tagName.slice(1)));
  const top = Math.min(...levels);
  return found.map((el, i) => ({ key: `${i} ${el.tagName}`, text: headingText(el), depth: levels[i] - top, el })).filter((h) => h.text);
}

/** How far below the pane's top a heading may sit and still be the section in view. */
const IN_VIEW = 24;

function WikiOutline({ index, focus, wikiPane }: SideBarOutlineProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  // Read the headings as the page draws them, and again when its content changes (a fold, a reload).
  useEffect(() => {
    const pane = wikiPane.current;
    if (!pane) { setHeadings([]); return; }
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setHeadings((before) => {
        const next = wikiHeadings(pane);
        return next.length === before.length && next.every((h, i) => h.el === before[i].el && h.text === before[i].text) ? before : next;
      }));
    };
    setHeadings(wikiHeadings(pane));
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(read);
    observer?.observe(pane, { childList: true, subtree: true, characterData: true });
    return () => { observer?.disconnect(); cancelAnimationFrame(frame); };
  }, [wikiPane, focus, index]);

  // The section in view: the last heading at or above the pane's top, as the wiki scrolls.
  useEffect(() => {
    const pane = wikiPane.current;
    if (!pane || headings.length === 0) { setCurrent(null); return; }
    const mark = () => {
      const top = pane.getBoundingClientRect().top + IN_VIEW;
      let at: string | null = headings[0].key;
      for (const h of headings) if (h.el.getBoundingClientRect().top <= top) at = h.key;
      setCurrent(at);
    };
    mark();
    pane.addEventListener('scroll', mark, { passive: true });
    return () => pane.removeEventListener('scroll', mark);
  }, [wikiPane, headings]);

  const jump = useCallback((h: Heading) => {
    const pane = wikiPane.current;
    if (!pane) return;
    const top = pane.scrollTop + h.el.getBoundingClientRect().top - pane.getBoundingClientRect().top - 8;
    pane.scrollTo?.({ top, behavior: readMotion().duration > 0 ? 'smooth' : 'auto' });
    setCurrent(h.key);
  }, [wikiPane]);

  if (!wikiPane.current && headings.length === 0) return <p className="hint">Open the Wiki view to see the page's outline.</p>;
  if (headings.length === 0) return <p className="hint">This page has no sections.</p>;
  return (
    <LongList
      label="Sections"
      className="record-list outline-list"
      items={headings}
      itemKey={(h) => h.key}
      searchText={(h) => h.text}
      itemClassName={(h) => `outline-depth-${Math.min(h.depth, 4)}`}
      render={(h) => (
        <Button className="row-link outline-heading" aria-current={h.key === current ? 'location' : undefined} onClick={() => jump(h)}>
          <span>{h.text}</span>
        </Button>
      )}
    />
  );
}

// ---------- Graph ----------

function GraphOutline({ index, graph, onNavigate, hrefFor }: SideBarOutlineProps) {
  const levels = useMemo(() => {
    if (!graph) return [];
    const nodes = graph.graph.nodes.filter((n) => n.kind !== FILE_KIND);
    const columns = [...new Set(nodes.map((n) => n.column))].sort((a, b) => a - b);
    return columns.map((c, i) => ({ level: i + 1, nodes: nodes.filter((n) => n.column === c).sort((a, b) => a.row - b.row) }));
  }, [graph]);
  if (!graph) return <p className="hint" role="status">Drawing the graph…</p>;
  if (levels.length === 0) return <p className="hint">Nothing in focus (check the filters).</p>;
  const center = graph.graph.focus;
  return (
    <>
      {levels.map(({ level, nodes }) => (
        <section key={level} className="side-bar-section" aria-labelledby={`outline-level-${level}`}>
          <h3 id={`outline-level-${level}`}>Level {level}{nodes.some((n) => n.id === center) && <small className="meta"> the center</small>}<span className="section-count">{nodes.length}</span></h3>
          <LongList
            label={`Level ${level}`}
            className="record-list outline-list"
            items={nodes}
            itemKey={(n) => n.id}
            searchText={(n) => `${n.id} ${n.title}`}
            itemClassName={(n) => (n.id === center ? 'is-center' : undefined)}
            render={(n) => (
              <NodeLink id={n.id} onNavigate={onNavigate} hrefFor={hrefFor} className="row-link outline-record">
                {n.group ? <span>{groupLabel(index, n.id)}</span> : <><code>{n.id}</code> <span>{n.title}</span></>}
                <small className="meta">{n.group ? 'Group' : kindLabel(index, n.kind)}</small>
              </NodeLink>
            )}
          />
        </section>
      ))}
    </>
  );
}

// ---------- Model ----------

function ModelOutline({ index, focus, onNavigate, hrefFor }: SideBarOutlineProps) {
  const erd = useMemo(() => erdFor(index, focus), [index, focus]);
  if (!erd) return <p className="hint">The Model view shows a domain, or an aggregate with its entities, commands, events and policies.</p>;
  if (erd.boxes.length === 0) return <p className="hint">{erd.level === 'domain' ? 'This domain has no aggregates yet.' : 'This aggregate has no entities yet.'}</p>;
  // What the diagram draws in focus, kind by kind in the schema's order, then the faded context.
  const inFocus = erd.boxes.filter((b) => !b.context);
  const kinds = [...new Set(inFocus.map((b) => b.kind))];
  const parts = [
    ...kinds.map((k) => {
      const boxes = inFocus.filter((b) => b.kind === k);
      return { key: k, title: listTitle(index, boxes.map((b) => index.byId.get(b.id)!).filter(Boolean), 'In focus'), boxes };
    }),
    { key: 'context', title: 'Faded', boxes: erd.boxes.filter((b) => b.context) },
  ].filter((p) => p.boxes.length > 0);
  return (
    <>
      {parts.map((p) => (
        <section key={p.key} className="side-bar-section" aria-labelledby={`outline-${p.key}`}>
          <h3 id={`outline-${p.key}`}>{p.title}<span className="section-count">{p.boxes.length}</span></h3>
          <LongList
            label={p.title}
            className="record-list outline-list"
            items={p.boxes}
            itemKey={(b) => b.id}
            searchText={(b) => `${b.id} ${b.title}`}
            itemClassName={(b) => (b.id === focus || b.highlight ? 'is-center' : undefined)}
            render={(b) => (
              <NodeLink id={b.id} onNavigate={onNavigate} hrefFor={hrefFor} className="row-link outline-record">
                <code>{b.id}</code> <span>{b.title}</span>
                {b.owner && <small className="meta">{b.owner}</small>}
              </NodeLink>
            )}
          />
        </section>
      ))}
    </>
  );
}
