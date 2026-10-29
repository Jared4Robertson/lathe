import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addressOf } from '../src/views/address';
import { recordIds } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

const PAGES = ['/', '/DM', '/NF', '/DM-SHOP', '/DM-PAY', '/DM?panel=checks',
  ...recordIds(workspace()).map((id) => addressOf(id))];

describe('record IDs are links', () => {
  it('LA-V92-R01-T01 Every record ID a page shows is a real link to that record', async () => {
    const ids = new Set(recordIds(workspace()));
    let checked = 0;
    for (const page of PAGES) {
      await openApp(page);
      await screen.findByRole('heading', { level: 1 });
      // The page, and the Checks panel over its stage.
      for (const code of [...main().querySelectorAll('code'), ...document.querySelectorAll('.tool-panel code')]) {
        const id = code.textContent ?? '';
        if (!ids.has(id)) continue;
        // That record's own page, at its ID: a product's and a domain's is their overview.
        const pages = [addressOf(id)];
        const link = code.closest('a');
        expect(link, `${id} on ${page} is not a link`).not.toBeNull();
        // A link on a stage keeps the stage (`?stage=`); its path is the record's address.
        expect(pages, `${id} on ${page} links to ${link!.getAttribute('href')}`).toContain(link!.getAttribute('href')!.split('?')[0]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});
