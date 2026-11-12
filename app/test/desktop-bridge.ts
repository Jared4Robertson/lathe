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
    chat: {
      sessions: async () => ({ claude: null, configured: false, signedIn: null, signIn: { status: 'idle', method: null, url: null, asksForCode: false, problem: null }, mode: 'accept-reads', current: null, sessions: [] }),
      open: async () => false,
      send: async () => false,
      answer: async () => false,
      stop: async () => false,
      setMode: async () => false,
      setModel: async () => false,
      unqueue: async () => false,
      skills: async () => [],
      captureStage: async () => null,
      signIn: async () => false,
      giveSignInCode: async () => false,
      cancelSignIn: async () => false,
      signOut: async () => false,
      onSignIn: () => () => {},
      onPatch: () => () => {},
    },
    voice: {
      listen: async () => ({ listening: 'unavailable', reason: 'Not in tests.' }),
      onEvent: () => () => {},
    },
    onAppRequest: () => () => {},
  };
}
