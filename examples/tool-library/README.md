# Tool Library

Lathe's example product: the HTTP API of a neighborhood tool library. Librarians register members and add tools; members borrow tools for 14 days (at most 3 at once, none while one is overdue); on return the librarian records the tool's condition, and a tool that needs repair is not lent until it is marked repaired. Damage reported while a tool is on loan is not cleared by a good return.

Due dates are dates (YYYY-MM-DD), counted in the library's time zone: a loan is due 14 calendar days after it starts and becomes overdue at 00:00 on the day after its due date in that zone.

The specification is in [data/](data/), one JSON Lines file per table of Lathe's model. It has one domain, Lending (`TL-LEND`), modeled with DDD and CQRS:

- **Domain model:** three aggregates (Member, Tool, Loan) with five entities; four value objects (`TL-VO01` Name to `TL-VO04` Note) and their constraints; six invariants (`TL-LEND-INV..`), four specifications (`TL-LEND-SP..`), six commands with the events they raise, the Catalog read model (worked out in memory on each request) and its query, one policy (a tool returned needing repair is taken out of lending), the Library calendar domain service and the glossary.
- **Use cases:** five use cases under three capabilities, each with its UC requirements (`TL-LEND-UC0n-R0n`) and one flow, whose steps invoke the commands and the query over the HTTP API (the example has no UI, so it has no views).
- **Interaction design:** seven endpoints (`TL-LEND-EP0n`), each under the command or query it exposes; the API's own rules (each body's fields, each error's status and code, what a success returns) are API requirements (`TL-LEND-EP0n-R0n`).
- **Technical specification:** the aggregates' data models (classes that enforce their own invariants and specifications), one repository per aggregate, the tables, value types, predicates, event types, one handler per command, query and endpoint, the projections and services that implement them, each naming its file; the Tool Library's own Entry point kind for `src/server.ts`; its own Report kind for `src/outcomes.ts`, which measures the business outcomes; and its own Tooling kind for `tsconfig.json` and `vitest.config.ts`, which name the packages they use, so every package `package.json` lists is accounted for.
- **Test plan:** one test kind per thing tested. Every source file names its technical records, and every automated test's name starts with its test record ID, so Lathe can trace each obligation to code and tests.

## Events and eventual consistency

Each command changes exactly one aggregate and raises its domain event: Member registered, Tool added, Damage reported, Tool repaired, Loan opened and Tool returned. Every event is delivered by outbox (`src/events.ts`), with no message broker: the command handler saves the event to the `outbox` table in the same SQLite transaction as its change, and once that commits, a small relay hands each undelivered event, oldest first, to the event handlers subscribed to it and marks it delivered.

The one policy, a tool returned needing repair is taken out of lending (`TL-LEND-PO01`), is an event handler: it hears Tool returned and, when the tool came back needing repair, invokes Report damage in its own transaction, with the return note as the damage note. So Return a tool changes only the loan, and the tool follows. That is eventual consistency, done in-process for the example: the relay runs synchronously after the commit, so the tool already needs repair when the return's response is sent, and a caller sees it on its next request. If the handler fails, the return still stands, the failure is logged, and the event stays in the outbox until the next relay run (after the next command, or when the API starts), so the reaction is never lost. A handler may therefore see an event more than once; by then the tool already needs repair, and a tool that needs repair keeps its first damage report (`TL-LEND-INV02`), so a second delivery changes nothing.

## Requirements

Node 26 or later (it runs the TypeScript directly and uses the built-in `node:sqlite`). No build step.

## Install

```sh
cd examples/tool-library
npm install
```

## Test

```sh
npm test            # vitest, at most 2 workers
npm run typecheck   # tsc --noEmit
```

- `test/domain-rules.test.ts`: the constraint tests (`TL-VO0n-C0n-T`), invariant tests (`TL-LEND-INV0n-T`), specification tests (`TL-LEND-SP0n-T`), the policy test (`TL-LEND-PO01-T`) and the domain service test (`TL-LEND-DS01-T01`), against the aggregates, the command handlers, the outbox and an in-memory database.
- `test/api.test.ts`: the use case tests (`TL-LEND-UC0n-R0n-T0n`), the endpoint tests (`TL-LEND-EP0n-R0n-T0n`) and the Librarian action pattern's rule tests (`TL-PAT-LIBRARIAN-ACTION-R0n-T01`), over HTTP on a free local port. A use case test and an endpoint test that share a scenario run one helper each.
- `test/outcomes.test.ts`: the outcome report (`TL-LEND-RP01`), over a month of loans made through the command handlers.
- `test/body-limit.test.ts`: the 64 KB body limit (`TL-LEND-EP06-R03-T01`), over HTTP and over a raw socket that sends a body that never ends.

The five flow tests (`TL-LEND-UC0n-FL01-T`, one per use case through the HTTP API, `TL-IF01`) are manual: they walk the curl steps below against a running server, and their records say why.

## Run

```sh
npm start                        # http://127.0.0.1:5310, in-memory database
PORT=5310 DB=library.db npm start  # keep the data in a SQLite file
TIME_ZONE=Europe/London npm start  # count days in another time zone
```

`TIME_ZONE` is the library's time zone, an IANA name; it defaults to `America/New_York`. A `library.db` created before due dates became dates has a `due_at` column; delete it and start again.

Stop it with Ctrl-C.

## Measure the business outcomes

```sh
DB=library.db npm run outcomes -- 2026-03   # one month, counted in TIME_ZONE
```

The report (`TL-LEND-RP01`) prints, as JSON, each business outcome's measure for the month from the library's own records: loans opened per tool in the catalog (`TL-BO01`), the share of loans due that month returned late or still out and overdue (`TL-BO02`), the repairs made that month and the median days from each tool's damage report to its repair, from the damage and repair events the outbox keeps (`TL-BO05`), and the members who opened a loan in the 90 days to the month's end (`TL-BO04`). Each outcome links to it with `measured_by`.

## API

| Endpoint | Method | Route | Does |
| --- | --- | --- | --- |
| TL-LEND-EP01 | POST | `/members` | Register a member: `{ "name", "email" }`. |
| TL-LEND-EP02 | POST | `/tools` | Add a tool: `{ "name", "description"? }`. |
| TL-LEND-EP03 | GET | `/tools` | List the catalog, each tool with `status`: `available`, `on_loan` or `needs_repair`. |
| TL-LEND-EP04 | POST | `/loans` | Borrow: `{ "memberId", "toolId" }`. Returns the loan with `dueDate` (YYYY-MM-DD). |
| TL-LEND-EP05 | POST | `/loans/{loanId}/return` | Return: `{ "condition": "good" \| "needs_repair", "note"? }`. Returns the loan with `late` (returned on a day after `dueDate`). |
| TL-LEND-EP06 | POST | `/tools/{toolId}/damage` | Mark a tool as needing repair: `{ "note" }`. A tool that already needs repair is refused (409 `tool_already_damaged`). |
| TL-LEND-EP07 | POST | `/tools/{toolId}/repair` | Mark a damaged tool repaired. |

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`, for example `409 { "error": "member_overdue", … }`. The API requirements under each endpoint record give every status and code. A body over 64 KB, on any endpoint, gets 413 `body_too_large` and the connection is closed.

```sh
curl -s -X POST localhost:5310/members -H 'content-type: application/json' -d '{"name":"Ada","email":"ada@example.org"}'
curl -s -X POST localhost:5310/tools   -H 'content-type: application/json' -d '{"name":"Cordless drill"}'
curl -s -X POST localhost:5310/loans   -H 'content-type: application/json' -d '{"memberId":1,"toolId":1}'
curl -s -X POST localhost:5310/loans/1/return -H 'content-type: application/json' -d '{"condition":"good"}'
curl -s -X POST localhost:5310/tools/1/damage -H 'content-type: application/json' -d '{"note":"Chuck wobbles"}'
curl -s -X POST localhost:5310/tools/1/repair
```

## Layout

| File | Technical records |
| --- | --- |
| `src/model.ts` | The value types (`TL-VO0n-VT`), the library calendar (`TL-LEND-DS01-SV`) and `LendingError`. |
| `src/member.ts` | The Member aggregate's root, `Member` (`TL-LEND-EN01-DM`). |
| `src/tool.ts` | The Tool aggregate: `Tool` (`TL-LEND-EN02-DM`), `DamageReport` (`EN03-DM`), `needsRepair` (`TL-LEND-SP04-PR`); it enforces `TL-LEND-INV02`. |
| `src/loan.ts` | The Loan aggregate: `Loan` (`TL-LEND-EN04-DM`), `LoanReturn` (`EN05-DM`) and the predicates `TL-LEND-SP01-PR` to `SP03-PR`; it enforces `TL-LEND-INV03` to `INV06`. |
| `src/database.ts` | The SQLite schema, `members`, `tools`, `loans` (`TL-LEND-EN01-TB`, `EN02-TB`, `EN04-TB`) and `outbox` (`TL-LEND-TB01`), and its transactions. |
| `src/member-repository.ts`, `src/tool-repository.ts`, `src/loan-repository.ts` | One repository per aggregate (`TL-LEND-REPO01` to `REPO03`), each reading and writing only its own table. |
| `src/events.ts` | The event types (`TL-LEND-EV01-ET` to `EV06-ET`) and the outbox, which saves and relays them. |
| `src/event-handlers.ts` | The event handler `TL-LEND-PO01-H`: a tool returned needing repair is taken out of lending. |
| `src/member-commands.ts` | The command handler `registerMember` (`TL-LEND-CMD01-H`). |
| `src/tool-commands.ts` | The command handlers `addTool`, `reportDamage` and `markToolRepaired` (`TL-LEND-CMD02-H` to `CMD04-H`). |
| `src/loan-commands.ts` | The command handlers `borrowTool` and `returnTool` (`TL-LEND-CMD05-H`, `CMD06-H`). |
| `src/catalog.ts` | The Catalog read model (`TL-LEND-RM01-TB`), its projection `catalogEntry` (`RM01-PJ`) and the query handler `listCatalog` (`TL-LEND-QRY01-H`). |
| `src/router.ts` | The endpoint handlers `postMembers` to `postToolRepair` (`TL-LEND-EP01-H` to `EP07-H`). It opens the Lending domain over the database, subscribes the event handler and runs the relay once at start. |
| `src/server.ts` | The entry point `TL-LEND-ENTRY01`. |
| `src/outcome-measures.ts` | The service `measureOutcomes` (`TL-LEND-DS02-SV`) and the read model's table `OutcomeMeasures` (`TL-LEND-RM02-TB`). |
| `src/outcomes.ts` | The projection `projectOutcomeMeasures` (`TL-LEND-RM02-PJ`), the query handler `getOutcomeMeasures` (`TL-LEND-QRY02-H`) and the report `printOutcomeReport` (`TL-LEND-RP01`). |
