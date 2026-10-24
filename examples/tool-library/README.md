# Tool Library

Lathe's example product: the HTTP API of a neighbourhood tool library. Librarians register members and add tools; members borrow tools for 14 days (at most 3 at once, none while one is overdue); on return the librarian records the tool's condition, and a tool that needs repair is not lent until it is marked repaired. Damage reported while a tool is on loan is not cleared by a good return.

Due dates are dates (YYYY-MM-DD), counted in the library's time zone: a loan is due 14 calendar days after it starts and becomes overdue at 00:00 on the day after its due date in that zone.

The specification is in [specs/tool-library/](../../specs/tool-library/). Every source file names its component record (`TL-LEND-C..`), and every automated test's name starts with its test record ID (`TL-LEND-T..`) or, in one case, the ID of the rule it proves (`TL-LEND-DR05`, the style S2 uses), so Lathe can trace each requirement, domain rule and interaction requirement to code and tests. The API's own rules (each body's fields, each error's status and code, what a success returns) are interaction requirements under the endpoint records (`TL-LEND-E0n-R0n`).

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

- `test/domain-rules.test.ts`: one test per domain rule (TL-LEND-T01 to T10, and T27), against the services and an in-memory database. The DR05 test is named by its rule ID.
- `test/api.test.ts`: one test per use case requirement and its endpoint rules (TL-LEND-T11 to T26), plus endpoint rules of their own (T28, T31, T32), over HTTP on a free local port.

Two tests are not automated: TL-LEND-T29 is a manual smoke test of the curl steps below, and TL-LEND-T30 (a body over 64 KB is refused with 413) is planned; their records say why.

## Run

```sh
npm start                        # http://127.0.0.1:5310, in-memory database
PORT=5310 DB=library.db npm start  # keep the data in a SQLite file
TIME_ZONE=Europe/London npm start  # count days in another time zone
```

`TIME_ZONE` is the library's time zone, an IANA name; it defaults to `America/New_York`. A `library.db` created before due dates became dates has a `due_at` column; delete it and start again.

Stop it with Ctrl-C.

## API

| Method | Route | Does |
| --- | --- | --- |
| POST | `/members` | Register a member: `{ "name", "email" }`. |
| POST | `/tools` | Add a tool: `{ "name", "description"? }`. |
| GET | `/tools` | List the catalog, each tool with `status`: `available`, `on_loan` or `needs_repair`. |
| POST | `/loans` | Borrow: `{ "memberId", "toolId" }`. Returns the loan with `dueDate` (YYYY-MM-DD). |
| POST | `/loans/{loanId}/return` | Return: `{ "condition": "good" \| "needs_repair", "note"? }`. Returns the loan with `late` (returned on a day after `dueDate`). |
| POST | `/tools/{toolId}/damage` | Mark a tool as needing repair: `{ "note" }`. |
| POST | `/tools/{toolId}/repair` | Mark a damaged tool repaired. |

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`, for example `409 { "error": "member_overdue", … }`. The interaction requirements under the endpoint records in `specs/tool-library/lending/02-design/endpoints/` give every status and code. A body over 64 KB gets 413 `body_too_large`.

```sh
curl -s -X POST localhost:5310/members -H 'content-type: application/json' -d '{"name":"Ada","email":"ada@example.org"}'
curl -s -X POST localhost:5310/tools   -H 'content-type: application/json' -d '{"name":"Cordless drill"}'
curl -s -X POST localhost:5310/loans   -H 'content-type: application/json' -d '{"memberId":1,"toolId":1}'
curl -s -X POST localhost:5310/loans/1/return -H 'content-type: application/json' -d '{"condition":"good"}'
```

## Layout

| File | Component |
| --- | --- |
| `src/model.ts` | TL-LEND-C01: records, values, settings and pure rules. |
| `src/store.ts` | TL-LEND-C02: SQLite storage and schema constraints. |
| `src/member-service.ts` | TL-LEND-C03: registering members. |
| `src/tool-service.ts` | TL-LEND-C04: the catalog, damage and repair. |
| `src/lending-service.ts` | TL-LEND-C05: borrowing and returning. |
| `src/router.ts` | TL-LEND-C06: the HTTP API. |
| `src/server.ts` | TL-LEND-C07: the entry point. |
