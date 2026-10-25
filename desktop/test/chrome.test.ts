import { describe, expect, it } from 'vitest';
import { applyChrome, chromeWindowOptions, DEFAULT_CHROME, parseChrome, TITLE_BAR_HEIGHT, type ChromeTarget } from '../src/chrome.ts';

describe('LA-DSK-T10 Each platform\'s window has no system title bar, with its controls over the app\'s own 38 px bar', () => {
  it('floats the traffic lights, centered in the bar, on macOS', () => {
    const options = chromeWindowOptions('darwin', false);
    expect(options).toEqual({ titleBarStyle: 'hidden', trafficLightPosition: { x: 14, y: 12 }, backgroundColor: DEFAULT_CHROME.light.background });
    expect(options.trafficLightPosition!.y * 2 + 14).toBe(TITLE_BAR_HEIGHT);
    expect(options.titleBarOverlay).toBeUndefined();
  });

  it('draws the native controls as an overlay in the shell\'s colors on Windows and Linux', () => {
    for (const platform of ['win32', 'linux'] as const) {
      expect(chromeWindowOptions(platform, true)).toEqual({
        titleBarStyle: 'hidden',
        titleBarOverlay: { color: DEFAULT_CHROME.dark.background, symbolColor: DEFAULT_CHROME.dark.foreground, height: TITLE_BAR_HEIGHT },
        backgroundColor: DEFAULT_CHROME.dark.background,
      });
    }
  });
});

function target() {
  const calls: { background: string[]; overlay: unknown[] } = { background: [], overlay: [] };
  const win: ChromeTarget = {
    setBackgroundColor: (c) => { calls.background.push(c); },
    setTitleBarOverlay: (o) => { calls.overlay.push(o); },
  };
  return { win, calls };
}

describe('LA-DSK-T11 The main process applies only valid theme colors to a window\'s chrome', () => {
  it('applies a valid chrome as the background, and as the controls\' overlay off a Mac', () => {
    const mac = target();
    expect(applyChrome(mac.win, 'darwin', { background: '#0a0f12', foreground: '#eee' })).toEqual({ background: '#0A0F12', foreground: '#EEEEEE' });
    expect(mac.calls).toEqual({ background: ['#0A0F12'], overlay: [] });
    const win = target();
    applyChrome(win.win, 'win32', { background: '#DDE3E6', foreground: '#1D2830' });
    expect(win.calls).toEqual({ background: ['#DDE3E6'], overlay: [{ color: '#DDE3E6', symbolColor: '#1D2830', height: TITLE_BAR_HEIGHT }] });
  });

  it('rejects anything but two opaque hex colors, and changes nothing', () => {
    const bad: unknown[] = [
      null, 'red', [], {}, { background: '#fff' },
      { background: 'red', foreground: '#000' },
      { background: '#ffffff80', foreground: '#000' },
      { background: '#fff', foreground: 'rgb(0, 0, 0)' },
      { background: '#fff; x', foreground: '#000' },
      { background: 0xffffff, foreground: '#000' },
      { background: '#fff', foreground: '#000', extra: 'x' },
    ];
    for (const input of bad) {
      const { win, calls } = target();
      expect(parseChrome(input)).toBeNull();
      expect(applyChrome(win, 'linux', input)).toBeNull();
      expect(calls).toEqual({ background: [], overlay: [] });
    }
  });
});
