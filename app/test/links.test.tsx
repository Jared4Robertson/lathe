import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { domainPath, productPath, recordPath } from '../src/specs/data';
import { records } from './fixtures/workspace';
import { main, openApp } from './helpers';

const PAGES = ['/specs', '/specs/DM', '/specs/NF', '/specs/DM/DM-SHOP', '/specs/DM/DM-PAY', '/checks',
  ...records.map((r) => recordPath(r.id))];

describe('record IDs are links', () => {
  it('LA-BRW-T15 Every record ID a page shows is a real link to that record', async () => {
    const byId = new Map(records.map((r) => [r.id, r]));
    let checked = 0;
    for (const page of PAGES) {
      await openApp(page);
      await screen.findByRole('heading', { level: 1 });
      for (const code of main().querySelectorAll('code')) {
        const id = code.textContent ?? '';
        const record = byId.get(id);
        if (!record) continue;
        // That record's own page: its record page, or its product or domain overview.
        const pages = [recordPath(id), productPath(id), record.product ? domainPath(record.product, id) : ''];
        const link = code.closest('a');
        expect(link, `${id} on ${page} is not a link`).not.toBeNull();
        expect(pages, `${id} on ${page} links to ${link!.getAttribute('href')}`).toContain(link!.getAttribute('href'));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});
