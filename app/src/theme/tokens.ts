// The tokens a theme may set (LA-PAT-APP-CODE-R15): every visual value in app/src/styles.css comes
// from a token in `:root`, and a theme is data that gives some of those tokens new values. This
// table names each settable token, what it is for, and how its value is checked, so the editor,
// the importer and the stylesheet writer all read one list.

/** The purpose a color token serves, which is how the editor groups them. */
export type ColorGroup = 'Surfaces' | 'Text' | 'Borders' | 'Accent' | 'Signals' | 'Graph' | 'Depth';

export interface ColorToken {
  name: `--${string}`;
  label: string;
  group: ColorGroup;
  /**
   * Core tokens are set by every theme in both light and dark. The others follow a core token
   * (an error follows the spark) or take Lathe's own value in each mode (the five stage colors),
   * unless a theme sets them.
   */
  core: boolean;
  /** What the token is drawn on, for its contrast warning: text needs 4.5:1, a control or large text 3:1. */
  on?: { bg: `--${string}`[]; min: number };
}

export const COLOR_GROUPS: readonly ColorGroup[] = ['Surfaces', 'Text', 'Borders', 'Accent', 'Signals', 'Graph', 'Depth'];

const TEXT = 4.5;
const CONTROL = 3;

export const COLOR_TOKENS: readonly ColorToken[] = [
  { name: '--shell', label: 'Shell, behind the panels', group: 'Surfaces', core: true },
  { name: '--paper', label: 'Paper, the page', group: 'Surfaces', core: true },
  { name: '--sheet', label: 'Sheet, cards and panels', group: 'Surfaces', core: true },
  { name: '--ink', label: 'Ink, body text', group: 'Text', core: true, on: { bg: ['--paper', '--sheet'], min: TEXT } },
  { name: '--muted', label: 'Muted text', group: 'Text', core: true, on: { bg: ['--paper', '--sheet'], min: TEXT } },
  { name: '--rule', label: 'Rule, borders and lines', group: 'Borders', core: true },
  { name: '--steel', label: 'Accent, links and the current item', group: 'Accent', core: true, on: { bg: ['--paper', '--sheet', '--steel-bg'], min: TEXT } },
  { name: '--steel-bg', label: 'Accent tint, behind the current item', group: 'Accent', core: true },
  { name: '--spark', label: 'Spark, events and design', group: 'Signals', core: true, on: { bg: ['--paper', '--sheet', '--spark-bg'], min: TEXT } },
  { name: '--spark-bg', label: 'Spark tint', group: 'Signals', core: true },
  { name: '--warn', label: 'Warning', group: 'Signals', core: true, on: { bg: ['--paper', '--sheet'], min: TEXT } },
  { name: '--error', label: 'Error', group: 'Signals', core: false, on: { bg: ['--paper', '--sheet', '--error-bg'], min: TEXT } },
  { name: '--error-bg', label: 'Error tint', group: 'Signals', core: false },
  { name: '--g-domain-model', label: 'Domain model stage', group: 'Graph', core: false, on: { bg: ['--g-domain-model-bg'], min: CONTROL } },
  { name: '--g-domain-model-bg', label: 'Domain model stage fill', group: 'Graph', core: false },
  { name: '--g-use-cases', label: 'Use cases stage', group: 'Graph', core: false, on: { bg: ['--g-use-cases-bg'], min: CONTROL } },
  { name: '--g-use-cases-bg', label: 'Use cases stage fill', group: 'Graph', core: false },
  { name: '--g-interaction-design', label: 'Interaction design stage', group: 'Graph', core: false, on: { bg: ['--g-interaction-design-bg'], min: CONTROL } },
  { name: '--g-interaction-design-bg', label: 'Interaction design stage fill', group: 'Graph', core: false },
  { name: '--g-technical-specification', label: 'Technical specification stage', group: 'Graph', core: false, on: { bg: ['--g-technical-specification-bg'], min: CONTROL } },
  { name: '--g-technical-specification-bg', label: 'Technical specification stage fill', group: 'Graph', core: false },
  { name: '--g-test-plan', label: 'Test plan stage', group: 'Graph', core: false, on: { bg: ['--g-test-plan-bg'], min: CONTROL } },
  { name: '--g-test-plan-bg', label: 'Test plan stage fill', group: 'Graph', core: false },
  { name: '--es-aggregate', label: 'Model: aggregates', group: 'Graph', core: false, on: { bg: ['--es-aggregate-bg'], min: TEXT } },
  { name: '--es-aggregate-bg', label: 'Model: aggregate fill', group: 'Graph', core: false },
  { name: '--es-command', label: 'Model: commands', group: 'Graph', core: false, on: { bg: ['--es-command-bg'], min: TEXT } },
  { name: '--es-command-bg', label: 'Model: command fill', group: 'Graph', core: false },
  { name: '--es-event', label: 'Model: events', group: 'Graph', core: false, on: { bg: ['--es-event-bg'], min: TEXT } },
  { name: '--es-event-bg', label: 'Model: event fill', group: 'Graph', core: false },
  { name: '--es-policy', label: 'Model: policies', group: 'Graph', core: false, on: { bg: ['--es-policy-bg'], min: TEXT } },
  { name: '--es-policy-bg', label: 'Model: policy fill', group: 'Graph', core: false },
  { name: '--es-read-model', label: 'Model: read models and queries', group: 'Graph', core: false, on: { bg: ['--es-read-model-bg'], min: TEXT } },
  { name: '--es-read-model-bg', label: 'Model: read model fill', group: 'Graph', core: false },
  { name: '--es-rule', label: 'Model: rules', group: 'Graph', core: false, on: { bg: ['--es-rule-bg'], min: TEXT } },
  { name: '--es-rule-bg', label: 'Model: rule fill', group: 'Graph', core: false },
  { name: '--g-structural', label: 'Structural records', group: 'Graph', core: false, on: { bg: ['--g-structural-bg'], min: CONTROL } },
  { name: '--g-structural-bg', label: 'Structural fill', group: 'Graph', core: false },
  { name: '--g-file', label: 'Files', group: 'Graph', core: false, on: { bg: ['--paper'], min: CONTROL } },
  { name: '--on-mark', label: 'Text on a colored mark', group: 'Depth', core: false, on: { bg: ['--spark', '--steel'], min: CONTROL } },
  { name: '--shadow-soft', label: 'Soft shadow', group: 'Depth', core: false },
  { name: '--shadow', label: 'Shadow', group: 'Depth', core: false },
  { name: '--shadow-strong', label: 'Strong shadow', group: 'Depth', core: false },
  { name: '--shadow-deep', label: 'Deep shadow', group: 'Depth', core: false },
  { name: '--backdrop', label: 'Backdrop behind dialogs', group: 'Depth', core: false },
];

/** The tokens that are not colors: type, shape and density, and motion. One value serves both modes. */
export type SettingToken = '--display' | '--body' | '--mono' | '--text-size' | '--density' | '--panel-radius' | '--panel-gap' | '--motion-speed' | '--hover-speed';

export const SETTING_TOKENS: readonly SettingToken[] = ['--display', '--body', '--mono', '--text-size', '--density', '--panel-radius', '--panel-gap', '--motion-speed', '--hover-speed'];

export const COLOR_NAMES = new Set<string>(COLOR_TOKENS.map((t) => t.name));
export const SETTING_NAMES = new Set<string>(SETTING_TOKENS);

/** Text size limits, in px: the body text, which every other size follows. */
export const TEXT_SIZE = { min: 12, max: 20 } as const;
export const RADIUS = { min: 0, max: 16 } as const;
export const GAP = { min: 0, max: 16 } as const;
/** Density: 1 is comfortable; compact tightens row padding and line height. */
export const DENSITY = { comfortable: 1, compact: 0.5, min: 0.25, max: 1.5 } as const;
/** The motion speeds when motion follows the system; "always reduced" sets both to 0ms. */
export const MOTION = { speed: '320ms', hover: '120ms', off: '0ms' } as const;

// ---------- Checking values ----------
// A theme's values are written into a <style> element, so each one must be exactly a value of its
// kind and nothing more: no semicolons, braces or other text that could reach past the token.

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FUNC = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.%\s,/+-]+\)$/;
const REF = /^var\(--[a-z][a-z0-9-]*\)$/;
const MIX = /^color-mix\(in srgb,\s*(?:var\(--[a-z][a-z0-9-]*\)|#[0-9a-fA-F]{3,8}|transparent)(?:\s+[0-9.]+%)?,\s*(?:var\(--[a-z][a-z0-9-]*\)|#[0-9a-fA-F]{3,8}|transparent)(?:\s+[0-9.]+%)?\)$/;

export function isColorValue(value: string): boolean {
  const v = value.trim();
  return HEX.test(v) || FUNC.test(v) || REF.test(v) || MIX.test(v) || v === 'transparent';
}

/** A font stack: family names, quoted or not, separated by commas. */
const FONT_STACK = /^\s*(?:"[\w\s.-]+"|'[\w\s.-]+'|[\w-]+(?:\s+[\w-]+)*)(?:\s*,\s*(?:"[\w\s.-]+"|'[\w\s.-]+'|[\w-]+(?:\s+[\w-]+)*))*\s*$/;
const PX = /^(\d+(?:\.\d+)?)px$/;
const MS = /^(\d+)ms$/;

const inRange = (value: string, re: RegExp, min: number, max: number) => {
  const m = value.trim().match(re);
  return !!m && Number(m[1]) >= min && Number(m[1]) <= max;
};

export function isSettingValue(token: SettingToken, value: string): boolean {
  switch (token) {
    case '--display': case '--body': case '--mono': return value.length <= 300 && FONT_STACK.test(value);
    case '--text-size': return inRange(value, PX, TEXT_SIZE.min, TEXT_SIZE.max);
    case '--panel-radius': return inRange(value, PX, RADIUS.min, RADIUS.max);
    case '--panel-gap': return inRange(value, PX, GAP.min, GAP.max);
    case '--density': return /^\d+(?:\.\d+)?$/.test(value.trim()) && Number(value) >= DENSITY.min && Number(value) <= DENSITY.max;
    case '--motion-speed': case '--hover-speed': return inRange(value, MS, 0, 2000);
  }
}

/** The px number in a value such as "15px". */
export const pxOf = (value: string) => Number(value.match(PX)?.[1] ?? NaN);

// ---------- Fonts ----------

/** The short, safe list of font stacks the editor offers; any other stack can be typed. */
export const FONT_CHOICES: readonly { label: string; stack: string; for: ('display' | 'body' | 'mono')[] }[] = [
  { label: 'Archivo (Lathe headings)', stack: '"Archivo", "Helvetica Neue", Arial, sans-serif', for: ['display'] },
  { label: 'Public Sans (Lathe text)', stack: '"Public Sans", "Segoe UI", system-ui, sans-serif', for: ['display', 'body'] },
  { label: 'System sans', stack: 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', for: ['display', 'body'] },
  { label: 'Humanist sans', stack: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", sans-serif', for: ['display', 'body'] },
  { label: 'Transitional serif', stack: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif', for: ['display', 'body'] },
  { label: 'Old-style serif', stack: '"Iowan Old Style", "Palatino Linotype", "URW Palladio L", P052, serif', for: ['display', 'body'] },
  { label: 'JetBrains Mono (Lathe code)', stack: '"JetBrains Mono", ui-monospace, Menlo, monospace', for: ['mono'] },
  { label: 'System mono', stack: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace', for: ['mono'] },
];
