import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BRIDGE_ENV, parseOpenRequest, startBridge, TOKEN_ENV, type Bridge, type OpenRequest } from '../src/bridge.ts';

let bridge: Bridge;
const opened: OpenRequest[] = [];
beforeAll(async () => {
  bridge = await startBridge({
    focus: async (key) => (key === 'w1' ? { connected: true, page: { focus: { id: 'SMK-ORD' } } } : null),
    open: async (key, request) => {
      if (key !== 'w1') return null;
      opened.push(request);
      return request.id === 'SMK-ORD' ? { ok: true, message: 'Opened SMK-ORD.' } : { ok: false, message: `There is no record ${request.id}.` };
    },
  });
});
afterAll(() => bridge.close());

function call(key: string, route: 'focus' | 'open', init: RequestInit = {}, token?: string) {
  const env = bridge.envFor(key);
  return fetch(`${env[BRIDGE_ENV]}/${route}`, { ...init, headers: { authorization: `Bearer ${token ?? env[TOKEN_ENV]}`, ...init.headers } });
}

describe('LA-PLT-UC19-R06-T02 The app bridge answers for its window, and only with its token', () => {
  it('serves on 127.0.0.1 with a window address and a token', () => {
    const env = bridge.envFor('w1');
    expect(env[BRIDGE_ENV]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/windows\/w1$/);
    expect(env[TOKEN_ENV]).toMatch(/^[0-9a-f]{48}$/);
  });

  it('says what the window is showing, and that a closed window is gone', async () => {
    const res = await call('w1', 'focus');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: true, page: { focus: { id: 'SMK-ORD' } } });
    expect((await call('w2', 'focus')).status).toBe(404);
  });

  it('opens a record, passing on the window\'s answer', async () => {
    const res = await call('w1', 'open', { method: 'POST', body: JSON.stringify({ id: 'SMK-ORD', stage: 'erd' }) });
    expect(await res.json()).toEqual({ ok: true, message: 'Opened SMK-ORD.' });
    expect(opened.at(-1)).toEqual({ id: 'SMK-ORD', stage: 'erd' });
    expect(await (await call('w1', 'open', { method: 'POST', body: JSON.stringify({ id: 'SMK-NOPE' }) })).json()).toEqual({ ok: false, message: 'There is no record SMK-NOPE.' });
    expect((await call('w1', 'open', { method: 'POST', body: '{"id":"../x"}' })).status).toBe(400);
  });

  it('refuses a caller without the token, and an unknown route', async () => {
    expect((await call('w1', 'focus', {}, 'wrong')).status).toBe(401);
    expect((await call('w1', 'open')).status).toBe(405);
    const env = bridge.envFor('w1');
    expect((await fetch(`${env[BRIDGE_ENV]}/other`, { headers: { authorization: `Bearer ${env[TOKEN_ENV]}` } })).status).toBe(404);
  });

  it('checks an open request', () => {
    expect(parseOpenRequest({ id: 'LA-PLT-UC19' })).toEqual({ id: 'LA-PLT-UC19', stage: null });
    expect(parseOpenRequest({ id: 'LA-PLT', stage: 'trace' })).toEqual({ id: 'LA-PLT', stage: 'trace' });
    expect(parseOpenRequest({ id: 'LA', stage: 'map' })).toBeNull();
    expect(parseOpenRequest({ id: '' })).toBeNull();
    expect(parseOpenRequest(null)).toBeNull();
  });
});
