import { describe, expect, it } from 'vitest';
import { EYEBROW_FONT, EYEBROW_RATIO, eyebrowRuns, NODE_TEXT, STATUS_FONT, STATUS_RATIO, TITLE_FONT } from '../../src/graph/text';
import { fontFor } from '../../src/graph/fonts';
import { SHAPES } from '../../src/graph/shapes';
import { BUILT_IN_THEMES } from '../../src/theme/theme';
import { colorOf } from '../../src/theme/audit';
import { contrast } from '../../src/theme/contrast';
import { STAGE_FILLS } from '../../src/theme/tokens';

// Node text's one type scale (LA-PAT-APP-UX-R24): three levels from one definition, read by every stage's boxes.

describe('the node text scale', () => {
  it('LA-PAT-APP-UX-R24-T01 Node text has three levels from one scale: the title leads, the eyebrow and the status line sit under it in size and weight, muted, and readable on every stage\'s fill', () => {
    // Three levels, no more.
    expect(Object.keys(NODE_TEXT)).toEqual(['title', 'eyebrow', 'status']);
    // The title leads: the largest and the heaviest, in ink.
    expect(NODE_TEXT.title).toEqual({ size: TITLE_FONT, weight: 600, tone: 'ink' });
    for (const level of [NODE_TEXT.eyebrow, NODE_TEXT.status]) {
      expect(level.size).toBeLessThan(NODE_TEXT.title.size);
      expect(level.weight).toBeLessThan(NODE_TEXT.title.weight);
      expect(level.tone).toBe('muted');
    }
    // The eyebrow about 0.72 of the title, the status line about 0.8: clearly secondary, still read at a glance.
    expect(EYEBROW_RATIO).toBeCloseTo(0.72, 2);
    expect(EYEBROW_FONT).toBe(TITLE_FONT * EYEBROW_RATIO);
    expect(STATUS_RATIO).toBeCloseTo(0.8, 2);
    expect(STATUS_FONT).toBe(TITLE_FONT * STATUS_RATIO);
    // Faces: the title and an eyebrow's words in the body face, a record ID alone in mono.
    const fonts = { body: 'Body', mono: 'Mono' };
    expect(fontFor(fonts, 'title', 10)).toBe('600 10px Body');
    expect(fontFor(fonts, 'eyebrow', 10)).toBe('400 10px Body');
    expect(fontFor(fonts, 'mono', 10)).toBe('400 10px Mono');
    expect(eyebrowRuns('Use case · LA-PRD-UC11')).toEqual([{ text: 'Use case · ', face: 'eyebrow' }, { text: 'LA-PRD-UC11', face: 'mono' }]);
    expect(eyebrowRuns('UC requirement · LA-EXP')).toEqual([{ text: 'UC requirement · ', face: 'eyebrow' }, { text: 'LA-EXP', face: 'mono' }]);
    expect(eyebrowRuns('3 steps · 2 proved')).toEqual([{ text: '3 steps · 2 proved', face: 'eyebrow' }]);
    // Muted text meets 4.5:1 on every stage's fill in every built-in theme, light and dark.
    const failing = BUILT_IN_THEMES.flatMap((theme) => (['light', 'dark'] as const).flatMap((mode) => STAGE_FILLS.flatMap((fill) => {
      const ratio = contrast(colorOf(theme, mode, '--muted')!, colorOf(theme, mode, fill)!);
      return ratio >= 4.5 ? [] : [`${theme.id} ${mode} on ${fill}: ${ratio.toFixed(2)}`];
    })));
    expect(failing).toEqual([]);
    // A label is centered only in a shape whose sides close in on it; every other is set at its left.
    expect(Object.entries(SHAPES).filter(([, s]) => s.centered).map(([name]) => name).sort()).toEqual(['diamond', 'hexagon', 'stadium']);
  });
});
