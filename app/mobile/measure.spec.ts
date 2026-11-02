import type { Page } from '@playwright/test';
import { expect, test } from '../stability/test';
import { clippedText, overlaps, smallTargets, unreachable, widePage, type Finding } from './measure';

// The phone checks proved on tiny fixture pages (LA-STD-EXPERIENCE-R13): each check finds the broken element and
// passes the sound one beside it, at 375 x 812 with touch. Run with `npm --prefix app run test:mobile-measure`.

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

const fixture = (page: Page, body: string) =>
  page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    body { margin: 0; font: 16px/1.4 sans-serif; } button { width: 48px; height: 48px; padding: 0; }
  </style></head><body>${body}</body></html>`);
const names = (found: Finding[]) => found.map((f) => f.name);

test.describe('LA-STD-EXPERIENCE-R13-T02 the phone checks', () => {
  test('wide page: content past the screen edge, or pushing a reading pane sideways, is found; content in a sideways scroller is not', async ({ page }) => {
    await fixture(page, `
      <div id="wide" style="width: 500px; height: 20px" aria-label="too wide"></div>
      <div style="overflow-x: auto"><div style="width: 900px; height: 20px" aria-label="in a scroller"></div></div>
      <div style="overflow: auto; height: 100px"><p style="height: 300px; margin: 0">Tall</p><code class="long" style="white-space: nowrap">LA-PAT-AGGREGATE-COMMANDS-R15-T01-AND-MORE-THAN-FITS</code></div>`);
    const found = await widePage(page);
    expect(names(found)).toEqual(['too wide', 'LA-PAT-AGGREGATE-COMMANDS-R15-T01-AND-MORE-THAN-FITS']);
    expect(found[0]).toMatchObject({ check: 'wide-page', selector: '#wide' });
  });

  test('clipped text: cut off, or an ellipsis without its whole text, is found; an ellipsis with a title, or text a scroller reaches, is not', async ({ page }) => {
    const long = 'A title far too long to fit in its narrow box';
    await fixture(page, `
      <div class="cut" style="width: 100px; overflow: hidden; white-space: nowrap">${long}</div>
      <div class="dots" style="width: 100px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis">${long}</div>
      <div class="titled" style="width: 100px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis" title="${long}">${long}</div>
      <div class="fits" style="width: 300px; overflow: hidden">Short</div>
      <div style="position: fixed; left: 0; right: 0; bottom: 0; height: 200px; overflow: hidden"><div style="height: 200px; overflow-y: auto">
        <p style="height: 500px; margin: 0">Tall</p><p class="below">Below the sheet's fold, reached by scrolling it</p></div></div>`);
    const found = await clippedText(page);
    expect(found.map((f) => f.selector)).toEqual(['div.cut', 'div.dots']);
    expect(found[0].detail).toContain('no ellipsis');
  });

  test('small targets: a small button or lone link is found; a 44 px button and a link inside a sentence are not', async ({ page }) => {
    await fixture(page, `
      <button style="width: 20px; height: 20px">x</button>
      <button>ok</button>
      <p>Read <a href="#a">the guide</a> before you start.</p>
      <p><a href="#b">alone</a></p>`);
    expect(names(await smallTargets(page))).toEqual(['x', 'alone']);
  });

  test('overlaps: targets over each other and a fixed bar over the last target are found; neighbors, wrapped links and a scrolling region are not', async ({ page }) => {
    await fixture(page, `
      <div style="position: relative; height: 60px">
        <button style="position: absolute; left: 0">one</button><button style="position: absolute; left: 20px">two</button>
      </div>
      <button>three</button><button>four</button>
      <p style="width: 200px">See <a href="#x">a link that wraps onto the next line</a> <a href="#y">and its neighbor</a> here.</p>
      <div style="position: relative"><div tabindex="0" style="height: 80px; overflow: auto"><div style="height: 300px"></div></div>
        <button style="position: absolute; top: 0; right: 0">float</button></div>
      <div style="height: 1200px"></div>
      <button>last</button>
      <nav style="position: fixed; bottom: 0; left: 0; right: 0; height: 70px; background: #eee"></nav>`);
    const found = await overlaps(page);
    expect(found.map((f) => f.name)).toEqual(['one', 'last']);
    expect(found[1].detail).toContain('covered by the fixed nav');
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });

  test('unreachable: a target left of the page or clipped away is found; one below the fold, in a scroller or shown on focus is not', async ({ page }) => {
    await fixture(page, `
      <button style="position: absolute; left: -100px; top: 0">left</button>
      <div style="width: 100px; height: 60px; overflow: hidden; position: relative"><button style="position: absolute; left: 200px">clipped</button></div>
      <div style="overflow-x: auto; white-space: nowrap; width: 100px"><span style="display: inline-block; width: 300px"></span><button>scrolled</button></div>
      <div style="height: 1500px"></div>
      <button>below</button>
      <a href="#main" style="position: absolute; left: -999px; top: 0" onfocus="this.style.left = '0'" onblur="this.style.left = '-999px'">Skip to content</a>`);
    expect(names(await unreachable(page))).toEqual(['left', 'clipped']);
  });

  test('a pannable map\'s contents are left to the map', async ({ page }) => {
    await fixture(page, `<div class="map" style="width: 200px; height: 200px; overflow: hidden; position: relative">
      <button style="position: absolute; left: 400px; width: 10px; height: 10px">node</button></div>`);
    expect(await unreachable(page, { pannable: '.map' })).toEqual([]);
    expect(await smallTargets(page, { pannable: '.map' })).toEqual([]);
    expect(names(await unreachable(page))).toEqual(['node']);
  });
});
