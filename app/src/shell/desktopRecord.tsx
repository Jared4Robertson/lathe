import { useEffect } from 'react';
import { parseSpecRoute } from '../views/spec-route';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { focusOf, isFocusRoute } from '../views/address';
import { desktopBridge } from './desktopChrome';
import { Button } from '../components/Button';
import './desktopRecord.css';

// The desktop app's record actions and Dock badge (LA-PLT-UC15). In the desktop shell a record's facts
// get Reveal, Open in editor and Copy ID, and a right-click on a record row, a graph node or the page
// title opens the shell's native menu of the same three. The product's error count goes to the Dock.
// In a browser none of this is drawn or listened for, so the app is unchanged there.

/**
 * The record a right-click is on: a graph box (on the graph's canvas, the box under the point, found
 * by its hit test; in its keyboard layer, the focused box), an ERD view node, a link to a record's
 * page, or the page's own title.
 */
export function recordIdAt(target: Element | null, pathname: string, known: (id: string) => boolean, at?: { x: number; y: number }): string | null {
  if (!target) return null;
  const canvas = target.closest<HTMLElement & { graphHit?: (x: number, y: number) => string | null }>('.graph-flow');
  const hit = at && target.tagName === 'CANVAS' && canvas?.graphHit ? canvas.graphHit(at.x, at.y) : null;
  if (hit && known(hit)) return hit;
  const node = target.closest('.react-flow__node[data-id], .graph-box[data-id]')?.getAttribute('data-id');
  if (node && known(node)) return node;
  const href = target.closest('a[href]')?.getAttribute('href');
  if (href?.startsWith('/')) {
    const route = parseSpecRoute(new URL(href, 'http://lathe.local').pathname);
    const id = isFocusRoute(route) ? focusOf(route) : null;
    if (id && known(id)) return id;
  }
  if (target.closest('#main h1')) {
    const route = parseSpecRoute(pathname);
    const id = isFocusRoute(route) ? focusOf(route) : null;
    if (id && known(id)) return id;
  }
  return null;
}

/** Sends the product's check errors to the Dock badge whenever the specs load or reload. */
export function useDesktopErrorCount(index: RecordIndex | null) {
  const setErrorCount = desktopBridge()?.setErrorCount;
  const count = index ? index.workspace.problems.filter((p) => p.severity === 'error').length : null;
  useEffect(() => {
    if (setErrorCount && count !== null) setErrorCount(count);
  }, [setErrorCount, count]);
}

/** The record the native record menu was last opened on, for its Open in New Tab (the `openRecordInNewTab` command). */
let menuRecord: string | null = null;
/** The record the native menu was opened on, once: its Open in New Tab takes it. */
export function takeMenuRecord(): string | null {
  const id = menuRecord;
  menuRecord = null;
  return id;
}

/** A right-click on a record opens the shell's native record menu in place of the browser's. */
export function useDesktopRecordMenu(index: RecordIndex | null) {
  const showRecordMenu = desktopBridge()?.showRecordMenu;
  useEffect(() => {
    if (!showRecordMenu || !index) return;
    const onMenu = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      // Text fields and selected text keep the shell's Cut, Copy and Paste menu.
      if (target?.closest('input, textarea, [contenteditable="true"]') || window.getSelection()?.toString().trim()) return;
      const id = recordIdAt(target, window.location.pathname, (candidate) => index.byId.has(candidate), { x: event.clientX, y: event.clientY });
      if (!id) return;
      event.preventDefault();
      menuRecord = id;
      showRecordMenu(id);
    };
    document.addEventListener('contextmenu', onMenu);
    return () => document.removeEventListener('contextmenu', onMenu);
  }, [showRecordMenu, index]);
}

const isMac = (platform: string) => platform === 'darwin';

/** Reveal, Open in editor and Copy ID for a record's data file: small quiet buttons, only in the desktop app. */
export function DesktopRecordActions({ id }: { id: string }) {
  const bridge = desktopBridge();
  if (!bridge) return null;
  const { revealRecord, openRecordInEditor, copyRecordId } = bridge;
  const reveal = isMac(bridge.platform) ? 'Reveal in Finder' : 'Show in folder';
  return (
    <span className="desktop-record-actions" role="group" aria-label={`Data file of ${id}`}>
      <Button onClick={() => revealRecord(id)}>{reveal}</Button>
      <Button onClick={() => openRecordInEditor(id)}>Open in editor</Button>
      <Button onClick={() => copyRecordId(id)}>Copy ID</Button>
    </span>
  );
}
