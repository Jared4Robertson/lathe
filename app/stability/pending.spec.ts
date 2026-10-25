import { test } from '@playwright/test';

// Scenarios the brief asks for that wait on other work (brief 53, notes/jitter-audit.md).
// Each turns into a measured scenario when its feature lands on main.
test.describe('waiting on other briefs', () => {
  test.fixme('LA-BRW-T489 switching theme (brief 49: themes)', () => {});
  test.fixme('LA-BRW-T490 the mobile sheets at 375 px (brief 52: mobile)', () => {});
});
