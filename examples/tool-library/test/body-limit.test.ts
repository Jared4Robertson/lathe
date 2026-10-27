// TL-LEND-EP06-R03-T01: the 64 KB body limit (TL-LEND-EP06-R03), over HTTP and over a raw socket.
// The test name starts with its test record ID (examples/tool-library/data/).
import { connect } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES } from '../src/router.ts';
import { startApi, type Api } from './helpers.ts';

let api: Api;
beforeEach(async () => {
  api = await startApi();
});
afterEach(async () => {
  await api.close();
});

const EMPTY_NOTE_BYTES = JSON.stringify({ note: '' }).length;

/** A damage report body of exactly `bytes` bytes of JSON. */
function damageBody(bytes: number): string {
  return JSON.stringify({ note: 'x'.repeat(bytes - EMPTY_NOTE_BYTES) });
}

async function post(path: string, body: string) {
  const res = await fetch(`http://127.0.0.1:${api.port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  return { status: res.status, headers: res.headers, body: await res.json() };
}

async function tool(): Promise<number> {
  const res = await api.call('POST', '/tools', { name: 'Drill' });
  return res.body.id;
}

async function conditionOf(toolId: number): Promise<string> {
  const res = await api.call('GET', '/tools');
  return res.body.find((t: { id: number }) => t.id === toolId).condition;
}

/**
 * Sends a chunked POST over a raw socket with no declared length and keeps writing chunks,
 * as fast as the socket allows, until the server answers or closes the connection.
 * Fails if the server has not closed it within 5 seconds.
 */
function sendEndlessBody(path: string): Promise<{ response: string; written: number }> {
  return new Promise((resolve, reject) => {
    const socket = connect(api.port, '127.0.0.1');
    const chunk = Buffer.alloc(16 * 1024, 'x');
    const frame = Buffer.concat([Buffer.from(`${chunk.length.toString(16)}\r\n`), chunk, Buffer.from('\r\n')]);
    let response = '';
    let written = 0;
    let writing = true;
    const giveUp = setTimeout(() => {
      socket.destroy();
      reject(new Error(`the server did not close the connection; ${written} body bytes written`));
    }, 5000);
    const pump = () => {
      while (writing && !socket.destroyed) {
        written += chunk.length;
        if (!socket.write(frame)) {
          socket.once('drain', pump);
          return;
        }
      }
    };
    socket.on('connect', () => {
      socket.write(
        `POST ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n`,
      );
      socket.write('9\r\n{"note":"\r\n');
      pump();
    });
    socket.on('data', (data) => {
      response += data.toString('utf8');
    });
    socket.on('close', () => {
      clearTimeout(giveUp);
      writing = false;
      resolve({ response, written });
    });
    // Writes the server no longer reads may end in a reset; the close above still settles the result.
    socket.on('error', () => {});
  });
}

describe('TL-LEND-EP06 Report damage to a tool', () => {
  it('TL-LEND-EP06-R03-T01 A damage report over 64 KB is refused with 413', async () => {
    // Exactly at the limit: read, parsed and saved.
    const t = await tool();
    const atLimit = await post(`/tools/${t}/damage`, damageBody(MAX_BODY_BYTES));
    expect(atLimit.status).toBe(200);
    expect(atLimit.body.damageNote).toHaveLength(MAX_BODY_BYTES - EMPTY_NOTE_BYTES);

    // One byte over: refused before it is parsed, the connection closed, nothing saved.
    const other = await tool();
    const over = await post(`/tools/${other}/damage`, damageBody(MAX_BODY_BYTES + 1));
    expect(over.status).toBe(413);
    expect(over.body.error).toBe('body_too_large');
    expect(over.headers.get('connection')).toBe('close');
    expect(await conditionOf(other)).toBe('good');

    // The same limit holds on every endpoint's body.
    const member = await post('/members', JSON.stringify({ name: 'Kim', email: 'kim@example.org', pad: 'x'.repeat(MAX_BODY_BYTES) }));
    expect(member.status).toBe(413);
    expect(member.body.error).toBe('body_too_large');
    expect((await api.call('POST', '/members', { name: 'Kim', email: 'kim@example.org' })).status).toBe(201);

    // A body that never ends: answered with 413 and the connection closed, without the server waiting for its end.
    const endless = await sendEndlessBody(`/tools/${other}/damage`);
    expect(endless.response).toMatch(/^HTTP\/1\.1 413 /);
    expect(endless.response).toContain('"error":"body_too_large"');
    expect(endless.response.toLowerCase()).toContain('connection: close');
    expect(await conditionOf(other)).toBe('good');
  });
});
