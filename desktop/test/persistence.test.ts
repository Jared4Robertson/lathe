import { describe, expect, it, vi } from 'vitest';
import { optOutOfWindowRestoration, restorationDefaultsCommands } from '../src/persistence.ts';

describe('LA-PLT-T125 The app opts out of macOS window restoration, so a killed run leaves nothing to reopen', () => {
  it('sets ApplePersistenceIgnoreState and NSQuitAlwaysKeepsWindows on macOS', () => {
    const setUserDefault = vi.fn();
    expect(optOutOfWindowRestoration('darwin', setUserDefault)).toBe(true);
    expect(setUserDefault.mock.calls).toEqual([
      ['ApplePersistenceIgnoreState', 'boolean', true],
      ['NSQuitAlwaysKeepsWindows', 'boolean', false],
    ]);
  });

  it('does nothing elsewhere', () => {
    const setUserDefault = vi.fn();
    for (const platform of ['win32', 'linux'] as const) expect(optOutOfWindowRestoration(platform, setUserDefault)).toBe(false);
    expect(setUserDefault).not.toHaveBeenCalled();
  });

  it('gives a test harness the same defaults for the unpacked Electron', () => {
    expect(restorationDefaultsCommands()).toEqual([
      ['write', 'com.github.Electron', 'ApplePersistenceIgnoreState', '-bool', 'YES'],
      ['write', 'com.github.Electron', 'NSQuitAlwaysKeepsWindows', '-bool', 'NO'],
    ]);
  });
});
