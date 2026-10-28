// Routes traced both ways between the records and the code (lathe/src/trace/routes.ts): the route normal form, the
// route-without-record gap, and the flow that keeps routes and records in step from the command line. The
// endpoint-route-not-in-file and view-route-not-in-file checks are tested with the other checks, in checks.test.ts.
import { afterAll, describe, expect, it } from 'vitest';
import { normalRoute, regexRoute, servedRoutes } from '../../src/trace/routes.ts';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { readConfig, SCHEMA_VERSION } from '../../src/config.ts';
import { complete, loadData, removeData, writeData } from '../helpers.ts';
import { add, gapsOf, LENDING, problemsOf, product, removeProducts } from '../flows/product.ts';
import type { Workspace } from '../../src/index.ts';

afterAll(() => {
  removeData();
  removeProducts();
});

/** The route-without-record gaps of a product outside its domains, by message. */
const unrecorded = (ws: Workspace, productId: string) =>
  (ws.coverage.find((c) => c.product === productId && c.domain === null)?.gaps ?? []).filter((g) => g.missing === 'route-without-record').map((g) => g.message);

describe('the route normal form', () => {
  it('LA-TRC-DS04-T01 routes written each way have one normal form', () => {
    for (const route of ['/tools/{toolId}/damage', '/tools/:id/damage', '/tools/<tool-id>/damage/', '/tools/[toolId]/damage', '/tools/${tool.id}/damage', '/tools//{id}/damage?note=1#top']) {
      expect(normalRoute(route), route).toBe('/tools/{}/damage');
    }
    expect(normalRoute('/')).toBe('/');
    expect(normalRoute('/?view=graph')).toBe('/');
    expect(normalRoute('/<id>?view=graph')).toBe('/{}');
    expect(normalRoute('/{id}.json')).toBe('/{}.json');
    expect(regexRoute(String.raw`^\/loans\/(\d+)\/return$`)).toBe('/loans/{}/return');
    expect(regexRoute(String.raw`^\/tools\/(?<id>[^/]+)$`)).toBe('/tools/{}');
    expect(regexRoute(String.raw`^\/files\/[^\/]+\/?$`)).toBe('/files/{}');
    expect(regexRoute(String.raw`^\/(a|b)+$`)).toBeNull();
    expect(regexRoute('^[a-z]+$')).toBeNull();
  });
});

describe('every route the code serves has a record', () => {
  it('LA-TRC-UC15-R03-T01 A route the code serves with no endpoint or view is a gap', async () => {
    const ws = await loadData(complete(), {
      files: {
        'lathe.config.json': `${JSON.stringify({ schema: SCHEMA_VERSION, routers: ['web/*.tsx'] })}\n`,
        'src/router.ts': [
          '// EX-LEND-EP01-H: POST /loans, and GET /old-loans only in a comment',
          "router.post('/loans', openLoan);",
          "router.delete('/loans/:id', closeLoan);",
          "if (pathname === '/health') return ok();",
          "const url = new URL(req.url ?? '/', 'http://localhost');",
        ].join('\n'),
        'web/routes.tsx': "export const CATALOG_PATH = '/catalog';\nconst routes = [{ path: '/tools/:id', element: <Tool /> }];\n",
      },
    });
    // Gaps of one record come in order of their messages.
    expect(unrecorded(ws, 'EX')).toEqual([
      'The code serves /health (src/router.ts, line 4), but no endpoint or view has that route; add one, or remove the route if nothing uses it.',
      'The code serves /tools/:id (web/routes.tsx, line 2), but no endpoint or view has that route; add one, or remove the route if nothing uses it.',
      'The code serves DELETE /loans/:id (src/router.ts, line 3), but no endpoint has that route; add one, or remove the route if nothing uses it.',
    ]);
    // The router files are glob patterns from the root, none by default; anything else is refused.
    const root = writeData({});
    expect(readConfig(root).routers).toEqual([]);
    writeFileSync(path.join(root, 'lathe.config.json'), '{ "routers": "src/router.ts" }');
    expect(() => readConfig(root)).toThrow('lathe.config.json: routers must be a list of file patterns from the root, such as ["src/router.ts"].');
    // What the patterns recognize, one file at a time.
    expect(servedRoutes("app.get('/a', f); // app.get('/b')\nconst HOME_ROUTE = '/';\nif (path !== `/c/${id}`) return;\nconst s = '/d';").map((r) => [r.method, r.normal])).toEqual([
      ['GET', '/a'], [null, '/'], [null, '/c/{}'],
    ]);
  });
});

describe('Routes kept in step from the command line', () => {
  it('LA-TRC-UC15-FL03-T routes and records are kept in step from the command line', async () => {
    const tl = product();
    // S01: an Agent writes an endpoint and its handler, whose file names the route with its parameter written another way.
    await tl.seed([
      ...LENDING,
      add('endpoint', { id: 'TL-LEND-EP01', title: 'POST /tools/{toolId}/loans', command_id: 'TL-LEND-CMD01', method: 'POST', route: '/tools/{toolId}/loans' }),
      add('endpoint_handler', { id: 'TL-LEND-EP01-H', title: 'postLoan', endpoint_id: 'TL-LEND-EP01', file: 'src/router.ts' }),
    ]);
    tl.write('src/router.ts', "// TL-LEND-EP01-H\nrouter.post('/tools/:id/loans', openLoan);\n");
    // S02: the check finds the route in the file, and S03 finds no route without a record.
    let ws = tl.workspace();
    expect(problemsOf(ws, 'endpoint-route-not-in-file')).toEqual([]);
    expect(gapsOf(ws, null).filter((g) => g.startsWith('route-without-record'))).toEqual([]);
    // S04: the record's route changes alone, and the check reports it as an error.
    tl.run('set', 'TL-LEND-EP01', '--route', '/loans', '--title', 'POST /loans');
    const refused = tl.check();
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain('[endpoint-route-not-in-file] TL-LEND-EP01: Endpoint TL-LEND-EP01 is POST /loans');
    tl.run('set', 'TL-LEND-EP01', '--route', '/tools/{toolId}/loans', '--title', 'POST /tools/{toolId}/loans');
    // S05: the router serves a route no record has; it is a gap until the Agent removes the route nothing uses.
    tl.write('src/router.ts', "// TL-LEND-EP01-H\nrouter.post('/tools/:id/loans', openLoan);\nrouter.get('/loans', listLoans);\n");
    ws = tl.workspace();
    expect(gapsOf(ws, null).filter((g) => g.startsWith('route-without-record'))).toEqual(['route-without-record TL']);
    expect(tl.check().stdout).toContain('[route-without-record] The code serves GET /loans (src/router.ts, line 3)');
    tl.write('src/router.ts', "// TL-LEND-EP01-H\nrouter.post('/tools/:id/loans', openLoan);\n");
    ws = tl.workspace();
    expect(gapsOf(ws, null).filter((g) => g.startsWith('route-without-record'))).toEqual([]);
    expect(problemsOf(ws, 'endpoint-route-not-in-file')).toEqual([]);
  });
});
