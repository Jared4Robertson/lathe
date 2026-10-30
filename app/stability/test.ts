import { test as base, expect } from '@playwright/test';

// The browser suites' one `test` (stability, a11y and perf import it, never Playwright's own; test/browser-suites.test.ts
// checks): a test fails when the page logs an error to the console or throws one, such as React's "The result of
// getSnapshot should be cached". Only the browser's own note of a refused request is not the app's error: a suite that
// edits data while the page is open sees the server refuse, and the page says so on screen.

/** The browser's own console line for a response with an error status, which the app does not write. */
const REFUSED_REQUEST = /^Failed to load resource: the server responded with a status of \d+/;

export const test = base.extend<{ consoleErrors: void }>({
  consoleErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && !REFUSED_REQUEST.test(message.text())) errors.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`uncaught: ${error.stack ?? error.message}`));
    await use();
    expect(errors, 'the page logged errors').toEqual([]);
  }, { auto: true }],
});

export { expect };
