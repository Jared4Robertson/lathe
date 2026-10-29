import './graph/setup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { resolveAddress } from '../src/router';
import { parseSpecRoute } from '../src/specs/data';
import { carryOverlays, closeTopmostHref, overlaysOf, pageHref, panelHref, withoutOverlays } from '../src/views/overlays';
import { crowded, openWidth, STAGE_MIN, type CrowdPanel, type Room } from '../src/views/openSpace';
import { checksPanel, openApp } from './helpers';

// Nothing replaces the stage: tools open as panels over it (LA-PAT-APP-UX-R20). The stage is what the Reader
// navigates; Checks, Appearance and the theme editor are frosted panels over it, a format page opens in the wiki
// card, and the products picker is a card over the last product's stage. Each is layered on the current focus in the
// address's query, so the stage keeps its place and every overlay is still a link; Escape closes the topmost.

const SRC = join(__dirname, '..', 'src');
const stage = () => screen.getByRole('region', { name: /stage$/ });
const nav = () => screen.getByRole('navigation', { name: 'Main' });
const NONE = new Set<CrowdPanel>();
const room = (width: number, patch: Partial<Room> = {}): Room => ({
  width, inset: 8, nav: { open: true, width: 336, rail: 56 }, card: true, chat: null, tool: null, held: NONE, ...patch,
});

describe('LA-PAT-APP-UX-R20 Nothing replaces the stage: tools open as panels over it', () => {
  it('LA-PAT-APP-UX-R20-T01 Every tool is an overlay in the address of the focus it is over, opened in order, closed topmost first, carried to a new focus, and counted in the open space', () => {
    // A patch of the current address: its parameters replace the current ones, moved to the end; empty ones go.
    expect(resolveAddress('?panel=checks', '?stage=erd')).toBe(`${window.location.pathname}?stage=erd&panel=checks`);
    expect(resolveAddress('?page=format/kinds/use_case#fields', '?panel=checks')).toBe(`${window.location.pathname}?panel=checks&page=format/kinds/use_case#fields`);
    expect(resolveAddress(panelHref(null), '?stage=erd&panel=theme&theme=custom-a')).toBe(`${window.location.pathname}?stage=erd`);
    expect(resolveAddress('/DM-SHOP')).toBe('/DM-SHOP');

    // The overlays an address opens, and the topmost: the one opened last.
    expect(overlaysOf('?panel=checks&page=format/checks/engine')).toEqual({ panel: 'checks', theme: null, page: 'format/checks/engine', top: 'page' });
    expect(overlaysOf('?page=format&panel=appearance')).toMatchObject({ panel: 'appearance', page: 'format', top: 'panel' });
    expect(overlaysOf('?panel=theme&theme=custom-a')).toMatchObject({ panel: 'theme', theme: 'custom-a', top: 'panel' });
    expect(overlaysOf('?panel=nothing&stage=erd')).toEqual({ panel: null, theme: null, page: null, top: null });
    expect(closeTopmostHref('?panel=checks&page=format')).toBe(pageHref(null));
    expect(closeTopmostHref('?page=format&panel=checks')).toBe(panelHref(null));
    expect(closeTopmostHref('?stage=erd')).toBeNull();

    // A move to another focus carries the tool, not the card's format page; a move off the stage carries nothing.
    const from = new URLSearchParams('?stage=erd&panel=checks&page=format');
    expect(carryOverlays('/DM-SHOP-INV01', from)).toBe('/DM-SHOP-INV01?panel=checks');
    expect(carryOverlays('/DM-SHOP-INV01?stage=trace', from)).toBe('/DM-SHOP-INV01?stage=trace&panel=checks');
    expect(carryOverlays('/DM?panel=appearance', from)).toBe('/DM?panel=appearance');
    expect(carryOverlays('/', from)).toBe('/');
    expect(carryOverlays('/DM-SHOP-INV01', new URLSearchParams('?panel=theme&theme=custom-a'))).toBe('/DM-SHOP-INV01?panel=theme&theme=custom-a');
    // A space remembers its page without the tools open over it.
    expect(withoutOverlays('?stage=erd&panel=checks&page=format')).toBe('?stage=erd');

    // No tool has a page of its own any more: their old addresses are no pages.
    for (const path of ['/format', '/format/kinds/use_case', '/settings/appearance']) expect(parseSpecRoute(path), path).toEqual({ page: 'missing' });

    // A tool covers part of the stage, so it shrinks the open space; it never collapses for space, the others give way.
    expect(openWidth(room(1920, { tool: 380 }), NONE)).toBe(openWidth(room(1920), NONE) - 388);
    expect([...crowded(room(1280))]).toEqual([]);
    expect([...crowded(room(1280, { tool: 380 }))]).toEqual(['card']);
    for (const width of [1440, 1920]) expect(openWidth(room(width, { tool: 600 }), crowded(room(width, { tool: 600 }))), String(width)).toBeGreaterThanOrEqual(STAGE_MIN);

    // One way to take and give back focus: the dialogs (quick open, the products picker) and the tool panels share it.
    const commands = readFileSync(join(SRC, 'shell', 'commands.tsx'), 'utf8');
    expect(commands).toMatch(/useOverlayFocus\(box/);
    expect(readFileSync(join(SRC, 'views', 'ToolPanel.tsx'), 'utf8')).toMatch(/useOverlayFocus\(box\)/);
  });

  it('LA-PAT-APP-UX-R20-T02 Checks, Appearance, the theme editor, a format page and the products picker each open over the stage, which keeps its focus; Escape closes the topmost and focus returns', async () => {
    const user = userEvent.setup();
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });

    // Checks from the nav: a frosted panel at the left of the open space, the stage and its focus still there.
    const checksLink = within(nav()).getByRole('link', { name: /^Checks \d+/ });
    await user.click(checksLink);
    expect(window.location.pathname + window.location.search).toBe('/DM-SHOP-UC01?panel=checks');
    expect(checksPanel()).toHaveAttribute('data-floating', 'left');
    expect(checksPanel()).toHaveFocus();
    expect(stage()).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Add an item to the basket' })).toBeInTheDocument();

    // A format page on top of it, in the wiki card; Escape closes it first, then the panel, and focus goes back to the nav.
    await user.click(within(checksPanel()).getAllByRole('link', { name: 'test-file-missing' })[0]);
    expect(window.location.search).toBe('?panel=checks&page=format/checks/test-file-missing');
    const card = screen.getByRole('region', { name: 'Wiki card' });
    await waitFor(() => expect(within(card).getByRole('heading', { level: 2, name: 'test-file-missing' })).toBeInTheDocument());
    await user.keyboard('{Escape}');
    expect(window.location.search).toBe('?panel=checks');
    await user.keyboard('{Escape}');
    expect(window.location.search).toBe('');
    expect(screen.queryByRole('region', { name: 'Checks' })).toBeNull();
    expect(checksLink).toHaveFocus();

    // Appearance: a popover from its button at the foot of the nav; the theme editor a larger panel; both over the stage.
    const appearanceLink = within(nav()).getByRole('link', { name: 'Appearance' });
    await user.click(appearanceLink);
    expect(appearanceLink).toHaveAttribute('aria-expanded', 'true');
    const popover = await screen.findByRole('region', { name: 'Appearance' });
    expect(popover).toHaveAttribute('data-floating', 'left');
    expect(stage()).toBeInTheDocument();
    await user.click(within(popover).getByRole('button', { name: 'Duplicate and edit Graphite' }));
    expect(await screen.findByRole('region', { name: 'Edit “Graphite copy”' })).toHaveAttribute('data-floating', 'left');
    expect(stage()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(window.location.search).toBe('');
    expect(screen.queryByRole('region', { name: /^Edit/ })).toBeNull();

    // Quick open stacks over a tool: Escape closes it alone, then the tool.
    await user.click(checksLink);
    await user.keyboard('{Control>}p{/Control}');
    expect(screen.getByRole('dialog', { name: 'Quick find' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(checksPanel()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Checks' })).toBeNull();

    // The products picker: a centered card over the dimmed stage of the product the Reader was in; Escape goes back.
    await openApp('/');
    const picker = await screen.findByRole('dialog', { name: 'Products' });
    expect(picker).toHaveClass('products-picker');
    await waitFor(() => expect(document.querySelector('.stage-layout.is-backdrop .focus-stage')).not.toBeEmptyDOMElement());
    expect(document.querySelector('.stage-layout.is-backdrop')).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(window.location.pathname).toBe('/DM-SHOP-UC01');
  });

  it('LA-V96-R25-T01 In the wiki card\'s summary a long value wraps at the card\'s width, its label column only as wide as its labels', () => {
    const css = readFileSync(join(SRC, 'styles.css'), 'utf8');
    expect(css).toMatch(/\.wiki-panel-summary \.fields > div \{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
    // A record link's title wraps with it, not in a column beside its ID.
    expect(css).toMatch(/\.wiki-panel-summary \.fields dd > a\.record-link \{[^}]*display:\s*inline/);
  });
});
