import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { openApp, serve } from './helpers';
import { testWorkspace } from './graph/workspace';
import { boxElements } from './graph/scene';

// On the web a browser tab is one place (LA-V103-R10): no tab strip of the app's, the browser's own history, its own
// tabs for a new place, and the place's depth, filters and wiki card kept in the browser tab's sessionStorage.

const served = () => ({ data: testWorkspace() });
const title = () => screen.getByRole('heading', { level: 1 }).textContent;
const address = () => window.location.pathname + window.location.search;
const stageButton = (name: 'Graph' | 'ERD' | 'Trace') => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });

describe('the web\'s place', () => {
  it('LA-V103-R10-T01 On the web there is no tab strip, and a move pushes the browser\'s own history', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(document.querySelector('.tab-strip')).toBeNull();
    // No empty tab row: no page bar, the page's controls at the right of the header strip's row, after the counts.
    expect(document.querySelector('.page-bar')).toBeNull();
    const strip = document.querySelector<HTMLElement>('.header-strip')!;
    expect(strip.lastElementChild).toHaveClass('page-bar-actions');
    expect(strip.lastElementChild!.previousElementSibling).toHaveClass('header-strip-counts');
    expect(within(strip).getByRole('group', { name: 'Stage' })).toBeInTheDocument();
    expect(document.querySelector('.stage-layout')).toHaveClass('one-place');
    const length = window.history.length;
    // A box clicked: one new entry of the browser's, with the stage kept.
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(1));
    const other = boxElements().find((b) => b.dataset.id !== 'P-D-UC01' && /^P-/.test(b.dataset.id ?? ''))!;
    fireEvent.click(other);
    await waitFor(() => expect(address()).toBe(`/${other.dataset.id}?stage=graph`));
    expect(window.history.length).toBe(length + 1);
    // The browser's Back goes back to the page before.
    await act(async () => { window.history.back(); });
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(address()).toBe('/P-D-UC01?stage=graph');
    // The app's tab keys do nothing here: no tab opens.
    fireEvent.keyDown(document.body, { key: 'T', code: 'KeyT', altKey: true, shiftKey: true });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(address()).toBe('/P-D-UC01?stage=graph');
  });

  it('LA-V103-R10-T02 On the web, Cmd or Ctrl+click and middle-click on a box open its address in a new browser tab', async () => {
    const open = vi.fn(() => null);
    vi.stubGlobal('open', open);
    await openApp('/P-D-UC01?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    fireEvent.click(stageButton('Graph'));
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(1));
    const other = boxElements().find((b) => b.dataset.id !== 'P-D-UC01' && /^P-/.test(b.dataset.id ?? ''))!;
    const to = `/${other.dataset.id}?stage=graph`;
    fireEvent.click(other, { metaKey: true });
    expect(open).toHaveBeenLastCalledWith(to, '_blank');
    fireEvent.click(other, { ctrlKey: true });
    expect(open).toHaveBeenCalledTimes(2);
    fireEvent(other, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    expect(open).toHaveBeenCalledTimes(3);
    expect(open).toHaveBeenLastCalledWith(to, '_blank');
    // The page itself stays where it was.
    expect(address()).toBe('/P-D-UC01?stage=graph');
    expect(title()).toBe('Lend a thing');
    // A link in the card is a real link: the browser opens it with a modifier key.
    const link = (await within(screen.getByRole('region', { name: 'Wiki card' })).findAllByRole('link', { name: /P-D-UC01-R01/ }))[0];
    expect(link.getAttribute('href')).toMatch(/^\/P-D-UC01-R01/);
  });

  it('LA-V103-R10-T03 On the web, the stage, depth, filters and wiki card are the browser tab\'s own, kept through a reload', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(document.querySelector<HTMLElement>('.page-bar-actions .wiki-panel-toggle')!);
    expect(screen.queryByRole('region', { name: 'Wiki card' })).toBeNull();
    fireEvent.click(stageButton('ERD'));
    await waitFor(() => expect(address()).toBe('/P-D-UC01?stage=erd'));
    // Kept in the browser tab's sessionStorage, not the window-wide settings.
    expect(JSON.parse(window.sessionStorage.getItem('lathe:place')!)).toMatchObject({ depth: 2, card: { open: false } });

    // A reload: the same stage, depth and card.
    cleanup();
    serve(served());
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(screen.getByRole('region', { name: 'ERD stage' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Wiki card' })).toBeNull();
    fireEvent.click(stageButton('Graph'));
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true'));
  });
});
