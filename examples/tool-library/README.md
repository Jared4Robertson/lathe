# Tool Library

Lathe's example product: the HTTP API of a neighbourhood tool library. Librarians register members and add tools; members borrow tools for 14 days (at most 3 at once, none while one is overdue); on return the librarian records the tool's condition, and a tool that needs repair is not lent until it is marked repaired.

The specification is in [specs/tool-library/](../../specs/tool-library/). Every source file names its component record (`TL-LEND-C..`), and every test name starts with its test record ID (`TL-LEND-T..`), so Lathe can trace each requirement and domain rule to code and tests.

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

- `test/domain-rules.test.ts`: one test per domain rule (TL-LEND-T01 to T10), against the services and an in-memory database.
- `test/api.test.ts`: one test per use case requirement (TL-LEND-T11 to T26), over HTTP on a free local port.

## Run

```sh
npm start                        # http://127.0.0.1:5310, in-memory database
PORT=5310 DB=library.db npm start  # keep the data in a SQLite file
```

Stop it with Ctrl-C.

## API

| Method | Route | Does |
| --- | --- | --- |
| POST | `/members` | Register a member: `{ "name", "email" }`. |
| POST | `/tools` | Add a tool: `{ "name", "description"? }`. |
| GET | `/tools` | List the catalog, each tool with `status`: `available`, `on_loan` or `needs_repair`. |
| POST | `/loans` | Borrow: `{ "memberId", "toolId" }`. Returns the loan with `dueAt`. |
| POST | `/loans/{loanId}/return` | Return: `{ "condition": "good" \| "needs_repair", "note"? }`. Returns the loan with `late`. |
| POST | `/tools/{toolId}/damage` | Mark a tool as needing repair: `{ "note" }`. |
| POST | `/tools/{toolId}/repair` | Mark a damaged tool repaired. |

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`, for example `409 { "error": "member_overdue", … }`. The endpoint records in `specs/tool-library/lending/02-design/endpoints/` list every status and code.

```sh
curl -s -X POST localhost:5310/members -H 'content-type: application/json' -d '{"name":"Ada","email":"ada@example.org"}'
curl -s -X POST localhost:5310/tools   -H 'content-type: application/json' -d '{"name":"Cordless drill"}'
curl -s -X POST localhost:5310/loans   -H 'content-type: application/json' -d '{"memberId":1,"toolId":1}'
curl -s -X POST localhost:5310/loans/1/return -H 'content-type: application/json' -d '{"condition":"good"}'
```

## Layout

| File | Component |
| --- | --- |
| `src/model.ts` | TL-LEND-C01: records, values and pure rules. |
| `src/store.ts` | TL-LEND-C02: SQLite storage and schema constraints. |
| `src/member-service.ts` | TL-LEND-C03: registering members. |
| `src/tool-service.ts` | TL-LEND-C04: the catalog, damage and repair. |
| `src/lending-service.ts` | TL-LEND-C05: borrowing and returning. |
| `src/router.ts` | TL-LEND-C06: the HTTP API. |
| `src/server.ts` | TL-LEND-C07: the entry point. |
