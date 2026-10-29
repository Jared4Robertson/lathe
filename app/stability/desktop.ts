import type { Page } from '@playwright/test';

// The desktop app in a browser: the shell's bridge (window.latheDesktop) stood in for before the page loads, every
// member a no-op, so the app shows what it shows in the desktop app (its tab strip, LA-V96-R10..R17, R31).

/** Makes the next pages load as the desktop app's. */
export async function asDesktop(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { latheDesktop: object }).latheDesktop = {
      isDesktop: true,
      platform: 'darwin',
      onCommand: () => () => {},
      setChrome: () => {},
      onFullScreen: (listener: (full: boolean) => void) => { listener(false); return () => {}; },
      setErrorCount: () => {},
      revealRecord: () => {},
      openRecordInEditor: () => {},
      copyRecordId: () => {},
      showRecordMenu: () => {},
      chat: {
        sessions: async () => ({ claude: null, configured: false, current: null, sessions: [] }),
        open: async () => false,
        send: async () => false,
        answer: async () => false,
        stop: async () => false,
        onPatch: () => () => {},
      },
      onAppRequest: () => () => {},
    };
  });
}
