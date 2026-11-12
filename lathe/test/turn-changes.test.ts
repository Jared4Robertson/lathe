// What a chat's turn changed (LA-PLT-UC19-R03, LA-EXP-QRY14 through LA-EXP-EP02): `POST /api/turn-changes` with the token
// `POST /api/snapshot` gave as the turn began answers the one record diff between the rows kept then and
// the data now, so the chat shows the turn's changes by record; a token the server no longer keeps is answered 404, and
// any method but POST 405.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import type { RecordChange } from '../src/changes.ts';
import { closeStores, handleApi } from '../src/server/api.ts';
import { removeData, writeData } from './helpers.ts';

afterAll(async () => {
  await closeStores();
  removeData();
});

const outcome = (id: string, title: string) => ({ id, title, product_id: 'TL', statement: 'Members borrow more.', measure: 'Loans per month.', target: 'Two a month.', measured_outside: 'Counted by hand.' });

describe('LA-PLT-UC19-R03-T03 a turn\'s changed records are the one record diff since the snapshot the turn began with', () => {
  it('answers the records the turn added and changed, by record, and refuses a token it does not keep and any other method', async () => {
    const root = writeData({
      product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
      business_outcome: [outcome('TL-BO01', 'Members borrow more')],
    });
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (pathname: string, body: unknown) => fetch(`${base}${pathname}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      const kept = await post('/api/snapshot', { product_id: 'TL' });
      expect(kept.status).toBe(200);
      const { snapshot } = (await kept.json()) as { snapshot: string };

      expect((await post('/api/turn-changes', { snapshot })).status).toBe(200);
      expect(await (await post('/api/turn-changes', { snapshot })).json()).toEqual([]);

      expect((await post('/api/business-outcome/add-business-outcome', outcome('TL-BO02', 'Tools come back on time'))).status).toBe(200);
      expect((await post('/api/business-outcome/change-business-outcome', { id: 'TL-BO01', title: 'Members borrow more often' })).status).toBe(200);

      const answer = await post('/api/turn-changes', { snapshot });
      expect(answer.status).toBe(200);
      expect(answer.headers.get('cache-control')).toBe('no-store');
      const changes = (await answer.json()) as RecordChange[];
      expect(changes.map((c) => `${c.change} ${c.id}`).sort()).toEqual(['added TL-BO02', 'changed TL-BO01']);
      expect(changes.find((c) => c.id === 'TL-BO01')!.fields).toEqual([{ name: 'title', before: 'Members borrow more', after: 'Members borrow more often' }]);

      const gone = await post('/api/turn-changes', { snapshot: 'snapshot-unknown' });
      expect(gone.status).toBe(404);
      expect(await gone.json()).toEqual({ error: 'The data from before that turn is no longer kept.' });
      expect((await fetch(`${base}/api/turn-changes`)).status).toBe(405);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
