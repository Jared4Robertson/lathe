import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// One axe-core audit of the page as it is now, at WCAG 2.2 AA (LA-PAT-APP-UX-R10).

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export interface Finding {
  state: string;
  rule: string;
  impact: string | null;
  help: string;
  targets: string[];
  summaries: string[];
}

/** The looks each width is audited in: the app's own theme in light and dark, and High contrast in both. */
export const LOOKS = [
  { name: 'Lathe light', theme: 'lathe', mode: 'light' },
  { name: 'Lathe dark', theme: 'lathe', mode: 'dark' },
  { name: 'High contrast light', theme: 'high-contrast', mode: 'light' },
  { name: 'High contrast dark', theme: 'high-contrast', mode: 'dark' },
] as const;
export type Look = (typeof LOOKS)[number];

/** Chooses the theme and mode before the app's scripts run, as a person's stored choice would. */
export async function useLook(page: Page, look: Look) {
  await page.addInitScript(({ theme, mode }) => {
    try {
      localStorage.setItem('lathe:theme', JSON.stringify(theme));
      localStorage.setItem('lathe:color-mode', JSON.stringify(mode));
    } catch { /* no storage */ }
  }, { theme: look.theme, mode: look.mode });
  await page.emulateMedia({ colorScheme: look.mode, reducedMotion: 'reduce' });
}

/** Audits the page (or the part `include` names) and records what it finds under `state`; a finding fails the test softly. */
export async function audit(page: Page, state: string, include?: string) {
  // Let fades and glides finish, so colors are read as they rest.
  await page.waitForTimeout(300);
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  const findings: Finding[] = results.violations.map((v) => ({
    state,
    rule: v.id,
    impact: v.impact ?? null,
    help: v.help,
    targets: v.nodes.map((n) => n.target.join(' ')),
    summaries: v.nodes.map((n) => (n.failureSummary ?? '').split('\n').slice(0, 3).join(' ').slice(0, 300)),
  }));
  await test.info().attach(`a11y: ${state}`, { body: JSON.stringify(findings), contentType: 'application/json' });
  const lines = findings.flatMap((f) => [`${f.rule} (${f.impact}): ${f.help}`, ...f.targets.slice(0, 6).map((t) => `    ${t}`)]);
  expect.soft(findings.length, `${state}\n${lines.join('\n')}`).toBe(0);
}
