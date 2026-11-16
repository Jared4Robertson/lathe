// The desktop shell's bridge (window.latheDesktop, desktop/src/preload.cts), stood in for with every member a
// no-op. It is the one stand-in every test uses: the component tests (test/helpers.tsx) and the browser suites
// (stability/desktop.ts), so a member the preload adds and the stand-in lacks fails typecheck, not a suite run.
// It is self-contained (no imports but the bridge type, no closures): the browser suites send its source to the page.
import type { LatheDesktop } from '../src/shell/desktop-bridge';

/** A whole desktop bridge, every member a no-op. */
export function desktopStandIn(): LatheDesktop {
  return {
    isDesktop: true,
    platform: 'darwin',
    onCommand: () => () => {},
    setChrome: () => {},
    onFullScreen: (listener) => { listener(false); return () => {}; },
    setMenuKeys: () => {},
    setErrorCount: () => {},
    revealRecord: () => {},
    openRecordInEditor: () => {},
    copyRecordId: () => {},
    showRecordMenu: () => {},
  };
}
