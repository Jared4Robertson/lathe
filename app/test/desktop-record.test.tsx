import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordIdAt } from '../src/shell/desktopRecord';
import { openApp } from './helpers';
import { workspace } from './fixtures/workspace';

// The desktop app's page hooks (LA-DSK-UC05): the record actions in a record's facts and on a
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
    setErrorCount: vi.fn<(count: number) => void>(),
    revealRecord: vi.fn<(id: string) => void>(),
    openRecordInEditor: vi.fn<(id: string) => void>(),
    copyRecordId: vi.fn<(id: string) => void>(),
    showRecordMenu: vi.fn<(id: string) => void>(),
  };
  host.latheDesktop = bridge;
  return { bridge, setFullScreen: (value: boolean) => fullScreen?.(value) };
}

afterEach(() => {
  delete host.latheDesktop;
  document.documentElement.removeAttribute('data-title-bar');
});

const heading = () => screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });

describe('desktop record actions', () => {
  it('LA-DSK-T24 A record\'s facts offer Reveal, Open in editor and Copy ID in the desktop app, and nothing in a browser', async () => {
    await openApp('/records/DM-SHOP-UC01');
    await heading();
    expect(screen.queryByRole('group', { name: 'Spec file of DM-SHOP-UC01' })).toBeNull();

    const { bridge } = desktop();
    await openApp('/records/DM-SHOP-UC01');
    await heading();
    const inspector = await screen.findByRole('complementary', { name: 'Inspector' });
    const actions = within(inspector).getByRole('group', { name: 'Spec file of DM-SHOP-UC01' });
    fireEvent.click(within(actions).getByRole('button', { name: 'Reveal in Finder' }));
    fireEvent.click(within(actions).getByRole('button', { name: 'Open in editor' }));
    fireEvent.click(within(actions).getByRole('button', { name: 'Copy ID' }));
    expect(bridge.revealRecord).toHaveBeenCalledWith('DM-SHOP-UC01');
    expect(bridge.openRecordInEditor).toHaveBeenCalledWith('DM-SHOP-UC01');
    expect(bridge.copyRecordId).toHaveBeenCalledWith('DM-SHOP-UC01');
  });

  it('LA-DSK-T24 A right-click on a record link or the page title opens the native record menu; elsewhere the page keeps its own', async () => {
    const { bridge } = desktop();
    await openApp('/records/DM-SHOP-UC01');
    const title = await heading();
    expect(fireEvent.contextMenu(title)).toBe(false);
    expect(bridge.showRecordMenu).toHaveBeenLastCalledWith('DM-SHOP-UC01');

    const link = document.querySelector<HTMLElement>('#main a[href^="/records/"]:not([href="/records/DM-SHOP-UC01"])')!;
    const target = decodeURIComponent(link.getAttribute('href')!.split('/')[2].split('?')[0]);
    expect(fireEvent.contextMenu(link.querySelector('code') ?? link)).toBe(false);
    expect(bridge.showRecordMenu).toHaveBeenLastCalledWith(target);

    bridge.showRecordMenu.mockClear();
    expect(fireEvent.contextMenu(document.querySelector('#main p') ?? document.body)).toBe(true);
    expect(bridge.showRecordMenu).not.toHaveBeenCalled();
  });

  it('LA-DSK-T24 The page sends its error count for the Dock badge, and the title bar drops the traffic lights\' room in full screen', async () => {
    const { bridge, setFullScreen } = desktop();
    await openApp('/records/DM-SHOP-UC01');
    await heading();
    const errors = workspace().problems.filter((p) => p.severity === 'error').length;
    await waitFor(() => expect(bridge.setErrorCount).toHaveBeenLastCalledWith(errors));

    const bar = screen.getByRole('banner', { name: 'Title bar' });
    expect(bar).toHaveClass('is-mac');
    expect(bar).not.toHaveClass('is-full-screen');
    act(() => setFullScreen(true));
    expect(bar).toHaveClass('is-full-screen');
    act(() => setFullScreen(false));
    expect(bar).not.toHaveClass('is-full-screen');
  });

  it('LA-DSK-T24 finds the record under a graph node, a link to a record, product or domain page, or the page title', () => {
    const known = (id: string) => ['DM', 'DM-SHOP', 'DM-SHOP-UC01'].includes(id);
    document.body.innerHTML = `
      <div class="react-flow__node" data-id="DM-SHOP-UC01"><span id="in-node">x</span></div>
      <div class="react-flow__node" data-id="DM-SHOP/use_case"><span id="in-group">x</span></div>
      <a href="/specs/DM/DM-SHOP?view=graph"><span id="in-domain">x</span></a>
      <a href="/records/NOPE"><span id="unknown">x</span></a>
      <a href="https://example.com"><span id="outside">x</span></a>
      <main id="main"><h1><span id="in-title">x</span></h1><p id="body">x</p></main>`;
    const at = (id: string, path = '/records/DM-SHOP-UC01') => recordIdAt(document.getElementById(id), path, known);
    expect(at('in-node')).toBe('DM-SHOP-UC01');
    expect(at('in-group')).toBeNull();
    expect(at('in-domain')).toBe('DM-SHOP');
    expect(at('unknown')).toBeNull();
    expect(at('outside')).toBeNull();
    expect(at('in-title')).toBe('DM-SHOP-UC01');
    expect(at('in-title', '/specs/DM')).toBe('DM');
    expect(at('in-title', '/checks')).toBeNull();
    expect(at('body')).toBeNull();
    document.body.innerHTML = '';
  });
});
