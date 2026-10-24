# Brief: the spec browser in the web app

Read [00-common-rules.md](00-common-rules.md) first.

## Goal
Let Jared navigate a product's specifications in the existing app: see products and domains with their coverage, open any record, and follow its links both ways, the way he now clicks through S2's Markdown, but with the structure and checks visible.

## Scope
- Read first: `lathe/src/types.ts`, `lathe/fixtures/workspace.sample.json`, `lathe/meta/kinds.csv`, and the whole current app (`app/src/*`, `app/server/model.ts`, `app/vite.config.ts`).
- You own: `app/**`.
- Out of scope: `lathe/` (the engine is built in parallel), `specs/`, `model/`. The existing Diagrams feature must keep working unchanged.

## What to build
1. Server: `app/server/spec.ts`, registered in `vite.config.ts`, serving `GET /api/spec` as the `Workspace` JSON. Get it from the engine with a dynamic import of `../../lathe/src/index.ts` and `loadWorkspace(repoRoot)`. The engine does not exist in your branch: when the import fails, or `LATHE_SPEC_FIXTURE=1` is set, serve `lathe/fixtures/workspace.sample.json` and add header `x-lathe-source: fixture`. Watch `specs/`, `examples/` and `lathe/` and send a `spec:changed` event so the page reloads.
2. Menu: add a **Specs** section to the existing left menu above or below Diagrams, listing each product and its domains.
3. Pages (client-side routes, like the existing `/diagrams/<slug>`):
   - `/specs/<product-id>`: the product, its domains as cards with coverage (requirements and rules: satisfied and proved, as small bars), its open questions, and its problems.
   - `/specs/<product-id>/<domain-id>`: the domain's records grouped by stage (Define: aggregates with their rules nested, use cases with their requirements nested; Design: flows, views, endpoints, components, tests), plus its coverage gaps and problems. A search box filters by ID or title.
   - `/records/<id>`: one record: ID, kind, title, its fields, its body rendered from Markdown (use `marked` and sanitise with `dompurify`), its parent and children, outgoing links grouped by relation and incoming links grouped by relation (each clickable), and the problems about it.
   - `/checks`: every problem, errors first, grouped by check, each linking to its record.
   - A short source note when the data is the fixture, so nobody mistakes it for real data.
4. Stretch, if time allows: a Graph tab on the domain page that draws the domain's records and links with the existing React Flow + ELK code.

Match the app's existing look (tokens and fonts in `styles.css`), keep keyboard focus visible, and make links real `<a href>` elements.

## Decisions already made
- Routing stays hand-rolled with the History API, as the Diagrams feature does; no router library.
- One `GET /api/spec` call returns the whole workspace; navigation happens in the client.

## Checks to run
`npx tsc --noEmit -p app`. If you start the dev server to look at it, use `npx vite --port 5320` inside `app/` with `LATHE_SPEC_FIXTURE=1`, and stop it before you finish.
