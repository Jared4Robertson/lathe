# Brief: the Tool Library example product

Read [00-common-rules.md](00-common-rules.md) first.

## Goal
Give Lathe a concrete example to organise, so the abstract model stays grounded. Specify a small product end to end as Lathe records (Define, then Design), then build it, with every requirement and domain rule designed by a component and proved by a test whose code carries the test's ID.

## The product
A neighbourhood **tool library**. Librarians register members and add tools to the catalog. Members borrow available tools for a loan period and return them; on return the librarian records the tool's condition. A damaged tool is taken out of lending until it is repaired. (It deliberately echoes Lathe's own foundation: people, tools, and a tool's condition.)

Example values, decided for this example: a loan lasts 14 days; a member may hold at most 3 active loans; a tool whose condition is "needs repair" cannot be lent; a member with an overdue loan cannot borrow.

## Scope
- Read first: `lathe/FORMAT.md`, `lathe/meta/*.csv`, and for style S2's Accounting domain (`~/Development/S2_sandbox/docs/specs/08-accounting/01-define/` and `.../02-design/02-technical-specification/`).
- You own: `specs/tool-library/**` and `examples/tool-library/**`.
- Out of scope: the engine (`lathe/`), the web app (`app/`), other products.

## What to write
1. Specs under `specs/tool-library/` with product `TL` and one domain `TL-LEND` (Lending), following FORMAT.md exactly, organised in folders `01-define/` and `02-design/`:
   - 3 aggregates (Member, Tool, Loan) with `relates_to` links, and 8 to 12 domain rules under them.
   - 4 to 5 use cases (register a member, add a tool, borrow a tool, return a tool, report damage), each with an `actor`, `applies` links to the rules it relies on, and 2 to 5 requirements each.
   - Design: 1 to 2 flows, 2 views (design only; no UI is built), one endpoint per API operation, components for the model, services and router with `satisfies`/`implements`/`depends_on` links, and one test record per test.
   - 1 to 2 open questions with `owner: Jared` about real product choices you could not settle.
   - Aim for full coverage: every requirement and domain rule has a component that `satisfies` it and a test that `proves` it.
2. Implementation in `examples/tool-library/`: TypeScript on Node 26, `node:sqlite` (or an in-memory store), an HTTP API using `node:http` or Hono, and vitest tests. Component records' `file` fields point at these real files (repo-relative). Each test record's `run_by` names the test file, and that test's name starts with the test record's ID, e.g. `it('TL-LEND-T03 A member with an overdue loan cannot borrow', …)`.
3. `examples/tool-library/README.md`: how to install, test and run it (port 5310 if you start it).

## Decisions already made
- Only one domain; keep it small and complete rather than broad.
- No frontend build; views exist only as design records.

## Checks to run
Type check and `npm test` inside `examples/tool-library` (max 2 workers). The engine is being built in parallel and is not in your branch, so check the format yourself: unique IDs, correct parents, only links allowed by relations.csv, every `run_by` file containing its test ID. A throwaway script outside the repo is fine; do not commit it.
