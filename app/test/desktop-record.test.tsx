import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordIdAt } from '../src/shell/desktopRecord';
import { desktopBridgeStub, facts, openApp } from './helpers';
import { workspace } from './fixtures/workspace';

// The desktop app's page hooks (LA-PLT-UC15; the record actions, LA-V92-R74): the record actions in a record's facts and on a
// right-click, the Dock badge's error count, and the title bar's room for the traffic lights, which
// goes in full screen. In a browser none of them is drawn or listened for.

const host = window as unknown as { latheDesktop?: LatheDesktop };

function desktop() {
  let fullScreen: ((value: boolean) => void) | undefined;
  const bridge = {
    isDesktop: true,
    platform: 'darwin',
    onCommand: () => () => {},
    setChrome: vi.fn(),
    onFullScreen: vi.fn((listener: (value: boolean) => void) => {
      fullScreen = listener;
      listener(false);
      return () => {};
    }),
    setMenuKeys: vi.fn<(keys: Record<string, string[]>) => void>(),
    setErrorCount: vi.fn<(count: number) => void>(),
    revealRecord: vi.fn<(id: string) => void>(),
    openRecordInEditor: vi.fn<(id: string) => void>(),
    copyRecordId: vi.fn<(id: string) => void>(),
    showRecordMenu: vi.fn<(id: string) => void>(),
    chat: desktopBridgeStub().chat,
    voice: desktopBridgeStub().voice,
    onAppRequest: () => () => {} };
  host.latheDesktop = bridge;
  return { bridge, setFullScreen: (value: boolean) => fullScreen?.(value) };
}

afterEach(() => {
  delete host.latheDesktop;
  document.documentElement.removeAttribute('data-title-bar');
});

const heading = () => screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });

describe('desktop record actions', () => {
  it('LA-V92-R74-T01 A record\'s facts offer Reveal, Open in editor and Copy ID in the desktop app, and nothing in a browser', async () => {
    await openApp('/DM-SHOP-UC01');
    await heading();
    // In a browser the Data file fact shows with no actions.
    expect(within(facts()).getByText('Data file', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Data file of DM-SHOP-UC01' })).toBeNull();

    const { bridge } = desktop();
    await openApp('/DM-SHOP-UC01');
    await heading();
    // The Data file fact, in the wiki card's whole page.
    const actions = await waitFor(() => within(facts()).getByRole('group', { name: 'Data file of DM-SHOP-UC01' }));
    fireEvent.click(within(actions).getByRole('button', { name: 'Reveal in Finder' }));
    fireEvent.click(within(actions).getByRole('button', { name: 'Open in editor' }));
    fireEvent.click(within(actions).getByRole('button', { name: 'Copy ID' }));
    expect(bridge.revealRecord).toHaveBeenCalledWith('DM-SHOP-UC01');
    expect(bridge.openRecordInEditor).toHaveBeenCalledWith('DM-SHOP-UC01');
    expect(bridge.copyRecordId).toHaveBeenCalledWith('DM-SHOP-UC01');
  });

  it('LA-V92-R74-T01 A right-click on a record link or the page title opens the native record menu; elsewhere the page keeps its own', async () => {
    const { bridge } = desktop();
    await openApp('/DM-SHOP-UC01');
    const title = await heading();
    expect(fireEvent.contextMenu(title)).toBe(false);
    expect(bridge.showRecordMenu).toHaveBeenLastCalledWith('DM-SHOP-UC01');

    const link = document.querySelector<HTMLElement>('#main a.record-link[href^="/DM-SHOP-"]:not([href="/DM-SHOP-UC01"])')!;
    const target = decodeURIComponent(link.getAttribute('href')!.split('/')[1].split('?')[0]);
    expect(fireEvent.contextMenu(link.querySelector('code') ?? link)).toBe(false);
    expect(bridge.showRecordMenu).toHaveBeenLastCalledWith(target);

    bridge.showRecordMenu.mockClear();
    expect(fireEvent.contextMenu(document.querySelector('#main p') ?? document.body)).toBe(true);
    expect(bridge.showRecordMenu).not.toHaveBeenCalled();
  });

  it('LA-V67-R01-T04 The page sends its error count for the Dock badge, and the title bar drops the traffic lights\' room in full screen', async () => {
    const { bridge, setFullScreen } = desktop();
    await openApp('/DM-SHOP-UC01');
    await heading();
    // The window's own product's errors (Demo shop's and the workspace's), not Notebook's.
    const errors = workspace().problems.filter((p) => p.severity === 'error' && !p.record?.startsWith('NF')).length;
    expect(errors).toBe(2);
    await waitFor(() => expect(bridge.setErrorCount).toHaveBeenLastCalledWith(errors));

    const bar = screen.getByRole('banner', { name: 'Title bar' });
    expect(bar).toHaveClass('is-mac');
    expect(bar).not.toHaveClass('is-full-screen');
    act(() => setFullScreen(true));
    expect(bar).toHaveClass('is-full-screen');
    act(() => setFullScreen(false));
    expect(bar).not.toHaveClass('is-full-screen');
  });

  it('LA-V92-R74-T01 finds the record under a graph node, a link to a record, product or domain page, or the page title', () => {
    const known = (id: string) => ['DM', 'DM-SHOP', 'DM-SHOP-UC01'].includes(id);
    document.body.innerHTML = `
      <div class="erd-flow"><div class="erd-access"><div class="erd-node" data-id="DM-SHOP-UC01"><span id="in-node">x</span></div><div class="erd-node" data-id="DM-SHOP/use_case"><span id="in-group">x</span></div></div></div>
      <div class="graph-flow" id="graph"><canvas id="graph-canvas"></canvas><div class="graph-box" data-id="DM-SHOP"><span id="in-box">x</span></div></div>
      <a href="/DM-SHOP?stage=graph"><span id="in-domain">x</span></a>
      <a href="/NOPE"><span id="unknown">x</span></a>
      <a href="https://example.com"><span id="outside">x</span></a>
      <main id="main"><h1><span id="in-title">x</span></h1><p id="body">x</p></main>`;
    const at = (id: string, path = '/DM-SHOP-UC01') => recordIdAt(document.getElementById(id), path, known);
    expect(at('in-node')).toBe('DM-SHOP-UC01');
    expect(at('in-group')).toBeNull();
    // On the graph's canvas, the box under the point, by the canvas's hit test; in its keyboard layer, the box.
    (document.getElementById('graph') as HTMLElement & { graphHit?: (x: number, y: number) => string | null }).graphHit = (x) => (x < 100 ? 'DM-SHOP-UC01' : null);
    expect(recordIdAt(document.getElementById('graph-canvas'), '/DM', known, { x: 50, y: 10 })).toBe('DM-SHOP-UC01');
    expect(recordIdAt(document.getElementById('graph-canvas'), '/DM', known, { x: 500, y: 10 })).toBeNull();
    expect(at('in-box')).toBe('DM-SHOP');
    expect(at('in-domain')).toBe('DM-SHOP');
    expect(at('unknown')).toBeNull();
    expect(at('outside')).toBeNull();
    expect(at('in-title')).toBe('DM-SHOP-UC01');
    expect(at('in-title', '/DM')).toBe('DM');
    expect(at('in-title', '/DM/checks')).toBeNull();
    expect(at('body')).toBeNull();
    document.body.innerHTML = '';
  });
});
