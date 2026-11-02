// A server opened to the local network: `lathe serve --network` listens on every interface and prints the addresses
// other devices open (LA-PLT-UC23-R04), and only this machine writes while other devices read (LA-PLT-UC23-R05). The
// guard is driven with requests whose socket names the address they come from, as a server on the network sees them.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { networkInterfaces, tmpdir, type NetworkInterfaceInfo } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { fromThisMachine, handleApi } from '../src/server/api.ts';
import { ACCESS_HEADER, READ_ONLY } from '../src/server/access.ts';
import { LOOPBACK_HOST, NETWORK_HOST, networkUrls, serve, type LatheServer } from '../src/server/serve.ts';
import { configuredRoot } from './store/fixture.ts';

const temps: string[] = [];
afterAll(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }); });

/** Starts `serve()` on a free port for an empty product, with a stand-in app page, and waits until it listens. */
async function started(host: string): Promise<{ running: LatheServer; port: number; address: string }> {
  const root = configuredRoot('lathe-network-');
  const appDir = mkdtempSync(path.join(tmpdir(), 'lathe-network-app-'));
  temps.push(root, appDir);
  writeFileSync(path.join(appDir, 'index.html'), '<!doctype html><title>Lathe</title>');
  const running = serve({ root, port: 0, host, appDir });
  await new Promise<void>((resolve, reject) => { running.server.once('listening', resolve); running.server.once('error', reject); });
  const { port, address } = running.server.address() as AddressInfo;
  return { running, port, address };
}

describe('LA-PLT-UC23-R04-T01 lathe serve listens on this machine alone unless asked for the network, and lists its addresses', () => {
  const info = (address: string, family: 'IPv4' | 'IPv6', internal: boolean) => ({ address, family, internal, netmask: '', mac: '', cidr: null }) as NetworkInterfaceInfo;

  it('lists one address per non-internal IPv4 interface, in order, and none for loopback, IPv6 or a machine with no network', () => {
    const interfaces = {
      lo0: [info('127.0.0.1', 'IPv4', true), info('::1', 'IPv6', true)],
      en0: [info('fe80::1', 'IPv6', false), info('192.168.1.20', 'IPv4', false)],
      en1: [info('10.0.0.5', 'IPv4', false)],
      utun0: undefined,
    };
    expect(networkUrls(interfaces, 5346)).toEqual(['http://192.168.1.20:5346', 'http://10.0.0.5:5346']);
    expect(networkUrls({ lo0: [info('127.0.0.1', 'IPv4', true)] }, 5330)).toEqual([]);
  });

  it('listens on loopback by default, and on every interface when asked, where this machine\'s network address reads', async () => {
    const plain = await started(LOOPBACK_HOST);
    expect(plain.address).toBe('127.0.0.1');
    await plain.running.stop();

    const open = await started(NETWORK_HOST);
    try {
      expect(open.address).toBe('0.0.0.0');
      // A machine with a network address answers on it; one with none (a sandbox) is proved on loopback alone.
      for (const url of [`http://127.0.0.1:${open.port}`, ...networkUrls(networkInterfaces(), open.port).slice(0, 1)]) {
        const page = await fetch(`${url}/`);
        expect(page.status).toBe(200);
        expect(await page.text()).toContain('<title>Lathe</title>');
      }
    } finally {
      await open.running.stop();
    }
  });
});

/** A request from `address` to `pathname`, as Node's server hands it over. */
function request(address: string, method: string, pathname: string, contentType: string): IncomingMessage {
  const req = Readable.from(['not json']) as unknown as IncomingMessage;
  Object.assign(req, { method, url: pathname, headers: { host: 'lathe.local:5346', 'content-type': contentType }, socket: { remoteAddress: address } });
  return req;
}

/** A response that keeps what was sent. */
function response() {
  const headers = new Map<string, string>();
  let body = '';
  const res = {
    statusCode: 200,
    setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
    end: (text: string) => { body = text; },
  };
  return { res: res as unknown as ServerResponse, headers, sent: () => ({ status: res.statusCode, body: body ? (JSON.parse(body) as { error?: string }) : null }) };
}

const ROUTE = '/api/use-case/add-use-case';

describe('LA-PLT-UC23-R05-T01 only this machine writes; another device is refused and marked read-only', () => {
  it('takes the loopback addresses as this machine, and nothing else', () => {
    for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) expect(fromThisMachine(address)).toBe(true);
    for (const address of ['192.168.1.20', '10.0.0.5', '::ffff:192.168.1.20', 'fe80::1', '127.0.0.2', undefined]) expect(fromThisMachine(address)).toBe(false);
  });

  it('lets a write from this machine past the guard, with no read-only mark', async () => {
    for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      const { res, headers, sent } = response();
      expect(await handleApi('/nowhere', request(address, 'POST', ROUTE, 'text/plain'), res, ROUTE)).toBe(true);
      // Past the guard, the next rule refuses the body: the write was not refused for where it came from.
      expect(sent().status).toBe(415);
      expect(headers.has(ACCESS_HEADER)).toBe(false);
    }
  });

  it('refuses every write from another device on the network, in domain words, and marks it read-only', async () => {
    for (const pathname of [ROUTE, '/api/snapshot', '/api/undo', '/api/turn-changes']) {
      const { res, headers, sent } = response();
      expect(await handleApi('/nowhere', request('192.168.1.20', 'POST', pathname, 'application/json'), res, pathname)).toBe(true);
      expect(sent()).toEqual({ status: 403, body: { error: 'Changes come only from the machine Lathe runs on; other devices on the network can read.' } });
      expect(headers.get(ACCESS_HEADER)).toBe(READ_ONLY);
    }
  });
});
