import { describe, expect, it } from 'vitest';
import { folderArgument, routeOpenFile, routeSecondInstance } from '../src/instance.ts';

describe('A second launch or a folder from Finder goes to the running app, which opens or focuses its window', () => {
  it('LA-PLT-DS04-T01 reads the folder from a command line, unpacked (electron . <folder>) or packed (Lathe <folder>), ignoring flags', () => {
    expect(folderArgument(['/electron', '.', '/work/shop'], false)).toBe('/work/shop');
    expect(folderArgument(['/Applications/Lathe.app/Contents/MacOS/Lathe', '/work/shop'], true)).toBe('/work/shop');
    expect(folderArgument(['/electron', '.', '--inspect', '/work/shop', '--no-sandbox'], false)).toBe('/work/shop');
    expect(folderArgument(['/electron', '.'], false)).toBeUndefined();
    expect(folderArgument(['/Applications/Lathe.app/Contents/MacOS/Lathe', '-psn_0_1234'], true)).toBeUndefined();
  });

  it('LA-PLT-DS04-T01 opens a second launch\'s folder, read from where it was launched, or else brings the app forward', () => {
    expect(routeSecondInstance(['/electron', '.', 'shop'], '/work', false)).toEqual({ kind: 'open', folder: '/work/shop' });
    expect(routeSecondInstance(['/electron', '.', '/elsewhere/shop/'], '/work', false)).toEqual({ kind: 'open', folder: '/elsewhere/shop' });
    expect(routeSecondInstance(['/Applications/Lathe.app/Contents/MacOS/Lathe'], '/', true)).toEqual({ kind: 'focus' });
  });

  it('LA-PLT-DS04-T01 opens a folder from Finder or the Dock at once, or once the app is ready', () => {
    expect(routeOpenFile('/work/shop', true)).toEqual({ kind: 'open', folder: '/work/shop' });
    expect(routeOpenFile('/work/shop/', false)).toEqual({ kind: 'later', folder: '/work/shop' });
  });
});
