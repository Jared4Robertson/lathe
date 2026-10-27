import { createServer, type Server } from 'node:net';
import { describe, expect, it } from 'vitest';
import { chooseDevSource, freePort, ROOT_HEADER, SHARED_PORT, SHARED_URL, type Probe } from '../src/devSource.ts';

const answers = (status: number, root?: string): Probe => async (url) => {
  expect(url).toBe(`${SHARED_URL}/api/spec`);
  return { status, headers: root ? { [ROOT_HEADER]: encodeURIComponent(root) } : {} };
};
const silent: Probe = async () => null;

describe('In development the window uses the 5199 server only when it answers for the opened folder', () => {
  it('LA-PLT-SP02-T uses http://localhost:5199 when it answers for the same folder', async () => {
    expect(await chooseDevSource('/repo/lathe', '/repo/lathe', answers(200, '/repo/lathe'))).toEqual({ kind: 'shared', url: 'http://localhost:5199' });
  });

  it('LA-PLT-SP02-T assumes the repo itself when the server does not name its folder', async () => {
    expect(await chooseDevSource('/repo/lathe', '/repo/lathe', answers(200))).toEqual({ kind: 'shared', url: SHARED_URL });
    expect(await chooseDevSource('/other/product', '/repo/lathe', answers(200))).toEqual({ kind: 'own' });
  });

  it('LA-PLT-SP02-T starts its own server when 5199 does not answer', async () => {
    expect(await chooseDevSource('/repo/lathe', '/repo/lathe', silent)).toEqual({ kind: 'own' });
  });

  it('LA-PLT-SP02-T starts its own server when 5199 answers for another folder, or with an error', async () => {
    expect(await chooseDevSource('/s2/docs', '/repo/lathe', answers(200, '/repo/lathe'))).toEqual({ kind: 'own' });
    expect(await chooseDevSource('/repo/lathe', '/repo/lathe', answers(500, '/repo/lathe'))).toEqual({ kind: 'own' });
  });

  it('LA-PLT-INV06-T never picks port 5199 for a server of its own', async () => {
    expect(SHARED_PORT).toBe(5199);
    const port = await freePort();
    expect(port).toBeGreaterThan(0);
    expect(port).not.toBe(5199);
  });

  it('LA-PLT-INV06-T skips a port it is told to avoid', async () => {
    const taken: Server = createServer();
    await new Promise<void>((resolve) => taken.listen(0, '127.0.0.1', resolve));
    const address = taken.address();
    const busy = typeof address === 'object' && address ? address.port : 0;
    const port = await freePort([5199, busy]);
    expect([5199, busy]).not.toContain(port);
    taken.close();
  });
});
