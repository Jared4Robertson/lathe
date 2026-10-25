import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openApp } from './helpers';

const PAGES = ['/', '/DM', '/DM-SHOP', '/DM-SHOP-C01', '/DM/checks', '/format'];

describe('fixture source note', () => {
  it('LA-EXP-T11 Every spec page says when it shows the sample fixture, and why', async () => {
    for (const page of PAGES) {
      await openApp(page, { source: 'fixture', reason: 'LATHE_SPEC_FIXTURE=1 is set' });
      const note = await screen.findByRole('note');
      expect(note).toHaveTextContent('Sample data. This is lathe/fixtures/workspace.sample.json, not your specs (LATHE_SPEC_FIXTURE=1 is set).');
    }
  });

  it('LA-EXP-T11 No note is shown when the engine serves the workspace', async () => {
    for (const page of PAGES) {
      await openApp(page, { source: 'engine' });
      await screen.findAllByRole('heading', { level: 1 }).catch(() => screen.findByText(/Lathe spec format/));
      expect(screen.queryByRole('note')).toBeNull();
    }
  });
});
