import './setup';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { APPEARANCE_STORAGE } from '../../src/platform/appearance/model';
import { openApp } from '../helpers';
import { canvasOf, scene } from './scene';
import { testWorkspace } from './workspace';
import { erdDrawn, erdHost, erdScene } from '../erd-scene';

// Scroll to zoom (LA-V62-R05, LA-PLT-CMD47): Appearance's switch and the palette's command turn it on or off, kept at
// once; the key bar says what scroll does, and the wheel follows it on the Graph and the ERD alike (LA-V93-R07).

/** A wheel event over a target, in the middle of the 1000 by 800 stage. */
const wheelOn = (target: Element, init: WheelEventInit) =>
  fireEvent(target, new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 500, clientY: 400, ...init }));
/** A new scroll: past the pause that ends the one before (wheelLatch), so a change of move is not dropped as its momentum. */
const pause = () => new Promise((r) => setTimeout(r, 200));
const scrollWords = () => document.querySelector('[data-key-entry="scroll"]')?.textContent;
const stored = () => window.localStorage.getItem(APPEARANCE_STORAGE.scrollToZoom.key);
/** The ERD's camera, as its canvas draws it. */
const erdView = () => erdScene().camera;

describe('LA-V62-R05-T01 Scroll to zoom, from Appearance or the palette, switches what scroll does on every stage', () => {
  it('pans by default, zooms once it is on with Cmd/Ctrl+scroll panning and a pinch zooming, and turns off from the palette', async () => {
    const user = userEvent.setup();
    await openApp('/P-D?stage=graph&panel=appearance', { data: testWorkspace() });
    const toggle = await screen.findByRole('switch', { name: 'Scroll to zoom' });
    await waitFor(() => expect(scene().boxes.length).toBeGreaterThan(0));

    // Off, the default: the key says scroll pans, and it does.
    expect(toggle).not.toBeChecked();
    expect(scrollWords()).toBe('Scroll pans');
    let before = scene().camera;
    wheelOn(canvasOf(), { deltaY: 40 });
    expect(scene().camera.zoom).toBe(before.zoom);
    expect(scene().camera.y).not.toBe(before.y);

    // On: kept at once, the key says so, and scroll zooms in on scrolling up.
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(stored()).toBe('true');
    expect(scrollWords()).toBe('Scroll zooms');
    expect(screen.getByRole('region', { name: 'Appearance' })).toHaveTextContent('Cmd or Ctrl with scroll pans');
    await pause();
    before = scene().camera;
    wheelOn(canvasOf(), { deltaY: -100 });
    expect(scene().camera.zoom).toBeGreaterThan(before.zoom);

    // Ctrl held on the keyboard with scroll pans; a pinch, which the browser sends with Ctrl set and no key down, zooms.
    await pause();
    fireEvent.keyDown(window, { key: 'Control', ctrlKey: true });
    before = scene().camera;
    wheelOn(canvasOf(), { deltaY: 40, ctrlKey: true });
    expect(scene().camera.zoom).toBe(before.zoom);
    expect(scene().camera.y).not.toBe(before.y);
    fireEvent.keyUp(window, { key: 'Control', ctrlKey: false });
    await pause();
    before = scene().camera;
    wheelOn(canvasOf(), { deltaY: -4, ctrlKey: true });
    expect(scene().camera.zoom).toBeGreaterThan(before.zoom);

    // The ERD follows the same rule: scroll zooms it too.
    fireEvent.click(within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name: 'ERD' }));
    await waitFor(() => expect(erdDrawn()).toBe(true));
    await pause();
    const erdBefore = erdView();
    wheelOn(erdHost()!.querySelector('canvas')!, { deltaY: -100 });
    await waitFor(() => expect(erdView().zoom).toBeGreaterThan(erdBefore.zoom));

    // The palette's command turns it off again, and the key and the switch say so.
    fireEvent.keyDown(document.body, { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    await user.type(within(palette).getByRole('combobox'), 'scroll to zoom');
    expect(within(palette).getAllByRole('option')[0]).toHaveTextContent('Turn scroll to zoom on or off');
    await user.keyboard('{Enter}');
    expect(stored()).toBe('false');
    expect(screen.getByRole('switch', { name: 'Scroll to zoom' })).not.toBeChecked();
    expect(scrollWords()).toBe('Scroll pans');
  });
});
