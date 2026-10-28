# Tool Library

Lathe's example product: the HTTP API of a neighborhood tool library. Librarians register members and add tools; members borrow tools for 14 days (at most 3 at once, none while one is overdue); on return the librarian records the tool's condition, and a tool that needs repair is not lent until it is marked repaired. Damage reported while a tool is on loan is not cleared by a good return.

Due dates are dates (YYYY-MM-DD), counted in the library's time zone: a loan is due 14 calendar days after it starts and becomes overdue at 00:00 on the day after its due date in that zone.

The specification is in [data/](data/), one JSON Lines file per table of Lathe's model. It has one domain, Lending (`TL-LEND`), modeled with DDD and CQRS:

- **Domain model:** three aggregates (Member, Tool, Loan) with five entities; four value objects (`TL-VO01` Name to `TL-VO04` Note) and their constraints; six invariants (`TL-LEND-INV..`), four specifications (`TL-LEND-SP..`), six commands with the events they raise, the Catalog read model (worked out in memory on each request) and its query, one policy (a tool returned needing repair is taken out of lending), the Library calendar domain service and the glossary.
- **Use cases:** five use cases under three capabilities, each with its UC requirements (`TL-LEND-UC0n-R0n`) and one flow, whose steps invoke the commands and the query over the HTTP API (the example has no UI, so it has no views).
- **Interaction design:** seven endpoints (`TL-LEND-EP0n`), each under the command or query it exposes; the API's own rules (each body's fields, each error's status and code, what a success returns) are API requirements (`TL-LEND-EP0n-R0n`).
- **Technical specification:** the repositories, data models, tables, value types, predicates, event types, handlers and service that implement them, each naming its file, and the Tool Library's own Entry point kind for `src/server.ts`.
- **Test plan:** one test kind per thing tested. Every source file names its technical records, and every automated test's name starts with its test record ID, so Lathe can trace each obligation to code and tests.

## Events and eventual consistency

Each command changes exactly one aggregate and raises its domain event: Member registered, Tool added, Damage reported, Tool repaired, Loan opened and Tool returned. Every event is delivered by outbox (`src/events.ts`), with no message broker: the command handler saves the event to the `outbox` table in the same SQLite transaction as its change, and once that commits, a small relay hands each undelivered event, oldest first, to the event handlers subscribed to it and marks it delivered.

The one policy, a tool returned needing repair is taken out of lending (`TL-LEND-PO01`), is an event handler: it hears Tool returned and, when the tool came back needing repair, invokes Report damage in its own transaction, with the return note as the damage note. So Return a tool changes only the loan, and the tool follows. That is eventual consistency, done in-process for the example: the relay runs synchronously after the commit, so the tool already needs repair when the return's response is sent, and a caller sees it on its next request. If the handler fails, the return still stands, the failure is logged, and the event stays in the outbox until the next relay run (after the next command, or when the API starts), so the reaction is never lost. A handler may therefore see an event more than once; reporting the same damage twice is harmless.

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

- `test/domain-rules.test.ts`: the constraint tests (`TL-VO0n-C0n-T`), invariant tests (`TL-LEND-INV0n-T`), specification tests (`TL-LEND-SP0n-T`), the policy test (`TL-LEND-PO01-T`) and the domain service test (`TL-LEND-DS01-T01`), against the model, the command handlers, the outbox and an in-memory database.
- `test/api.test.ts`: the use case tests (`TL-LEND-UC0n-R0n-T0n`), the endpoint tests (`TL-LEND-EP0n-R0n-T0n`) and the Librarian action pattern's rule tests (`TL-PAT-LIBRARIAN-ACTION-R0n-T01`), over HTTP on a free local port. A use case test and an endpoint test that share a scenario run one helper each.
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

## API

| Endpoint | Method | Route | Does |
| --- | --- | --- | --- |
| TL-LEND-EP01 | POST | `/members` | Register a member: `{ "name", "email" }`. |
| TL-LEND-EP02 | POST | `/tools` | Add a tool: `{ "name", "description"? }`. |
| TL-LEND-EP03 | GET | `/tools` | List the catalog, each tool with `status`: `available`, `on_loan` or `needs_repair`. |
| TL-LEND-EP04 | POST | `/loans` | Borrow: `{ "memberId", "toolId" }`. Returns the loan with `dueDate` (YYYY-MM-DD). |
| TL-LEND-EP05 | POST | `/loans/{loanId}/return` | Return: `{ "condition": "good" \| "needs_repair", "note"? }`. Returns the loan with `late` (returned on a day after `dueDate`). |
| TL-LEND-EP06 | POST | `/tools/{toolId}/damage` | Mark a tool as needing repair: `{ "note" }`. |
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
| `src/model.ts` | The data models (`TL-LEND-EN0n-DM`), value types (`TL-VO0n-VT`), predicates (`TL-LEND-SP0n-PR`) and the Library calendar service (`TL-LEND-DS01-SV`). |
| `src/store.ts` | The repositories (`TL-LEND-A1-REPO` to `A3-REPO`), the tables `members`, `tools` and `loans` (`TL-LEND-EN01-TB`, `EN02-TB`, `EN04-TB`) and the `outbox` table. |
| `src/events.ts` | The event types (`TL-LEND-EV01-ET` to `EV06-ET`) and the outbox's relay, which delivers them. |
| `src/event-handlers.ts` | The event handler `TL-LEND-PO01-H`: a tool returned needing repair is taken out of lending. |
| `src/member-service.ts` | The command handler `TL-LEND-CMD01-H`: registering members. |
| `src/tool-service.ts` | The command handlers `TL-LEND-CMD02-H` to `CMD04-H` and the query handler `TL-LEND-QRY01-H`: the catalog, damage and repair. |
| `src/lending-service.ts` | The command handlers `TL-LEND-CMD05-H` and `CMD06-H`: borrowing and returning. |
| `src/router.ts` | The endpoint handlers `TL-LEND-EP01-H` to `EP07-H`: the HTTP API. It gives the command handlers one outbox, subscribes the event handler and runs the relay once at start. |
| `src/server.ts` | The entry point `TL-LEND-ENTRY01`. |
