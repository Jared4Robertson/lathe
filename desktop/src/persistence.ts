// macOS window restoration, turned off (LA-DSK-DR15). Lathe reopens its own windows from its own saved
// state (the last folder, window-state.json), so the system's restoration has nothing to add, and an
// Electron that was killed while macOS restored its windows (a smoke run cut short, say) makes macOS ask
// "it unexpectedly quit while reopening windows. Do you want to try to reopen its windows again?" at the
// next launch. With these user defaults in the app's own domain, macOS keeps no window state for it,
// and there is nothing to reopen or ask about:
//   ApplePersistenceIgnoreState  YES: the app ignores (and does not write) saved window state, which is
//                                what suppresses the reopen prompt;
//   NSQuitAlwaysKeepsWindows     NO: quitting keeps no windows to restore, whatever the system setting.

export const RESTORATION_DEFAULTS = [
  { key: 'ApplePersistenceIgnoreState', value: true },
  { key: 'NSQuitAlwaysKeepsWindows', value: false },
] as const;

/** The bundle ID of the unpacked Electron that `npm start`, `npm run dev` and the smoke test run. */
export const DEV_BUNDLE_ID = 'com.github.Electron';

type SetUserDefault = (key: string, type: 'boolean', value: boolean) => void;

/** Opts the app out of macOS window restoration, on macOS only. Call it before the app is ready. */
export function optOutOfWindowRestoration(platform: NodeJS.Platform, setUserDefault: SetUserDefault): boolean {
  if (platform !== 'darwin') return false;
  for (const { key, value } of RESTORATION_DEFAULTS) setUserDefault(key, 'boolean', value);
  return true;
}

/** The same, as `defaults write` arguments, for a test harness to run before it launches Electron. */
export function restorationDefaultsCommands(bundleId = DEV_BUNDLE_ID): string[][] {
  return RESTORATION_DEFAULTS.map(({ key, value }) => ['write', bundleId, key, '-bool', value ? 'YES' : 'NO']);
}
