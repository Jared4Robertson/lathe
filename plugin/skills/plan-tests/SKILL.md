---
name: plan-tests
description: Write or change Lathe test records and the tests they name - one test kind per thing tested (constraint, invariant, specification, policy, domain service, use case, view, endpoint, flow, integration, pattern rule and standard rule tests), each under what it proves, with its run by (level, state, a file or a manual reason, size and markers), and the test data sets tests start from. Use when planning which tests prove which obligations, writing a test for a Lathe test record, or deciding whether a test is automated, manual or not automated yet, in a repo with lathe.config.json.
---

# Plan tests

Every test proves exactly its parent: a constraint test its constraint, a use case test its UC requirement, and so on. An obligation is **proved** when its tests exist, at a level its kind allows, automated or manual. Write the test plan last, after the record it proves.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files: `add`, `set`, `move`, `link`, `unlink` and `remove` write; `show`, `list` and `next_id` read; `check` runs the checks. Each write is checked against the schema and refused, with its reasons, when it breaks the model; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task, the test record with its test.

- The `add` tool's input schema lists each test kind's columns. In a shell, `lathe add <test kind> --help` prints the same (`npx lathe` in a product repo; `npm --prefix lathe run lathe -- <command> --root ..` in the Lathe repo).
- Take each test's ID from `next_id`, with what it proves as `parent`. A kind with exactly one test per parent gives that one ID (`TL-LEND-INV01-T`); the others are numbered (`TL-LEND-UC01-R01-T01`).

## The test kinds

| Test kind | Proves (its parent) | How many | ID | Levels it allows |
| --- | --- | --- | --- | --- |
| `constraint_test` | a constraint | exactly one | `<constraint>-T` | unit |
| `invariant_test` | an invariant | exactly one | `<invariant>-T` | unit, database |
| `specification_test` | a specification | exactly one | `<specification>-T` | unit, database |
| `policy_test` | a policy | exactly one | `<policy>-T` | database, api, e2e-api |
| `domain_service_test` | a domain service | at least one | `<domain service>-T<nn>` | unit |
| `use_case_test` | a UC requirement | at least one | `<UC requirement>-T<nn>` | api, e2e-api, e2e-ui, manual |
| `view_test` | a view requirement | at least one | `<view requirement>-T<nn>` | unit, e2e-ui, manual |
| `endpoint_test` | an API requirement | at least one | `<API requirement>-T<nn>` | contract, api |
| `flow_test` | a flow: a smoke test of its main path | exactly one | `<flow>-T` | e2e-ui, manual |
| `integration_test` | an integration | any | `<integration>-T<nn>` | contract, e2e-api, manual |
| `pattern_rule_test` | a pattern rule, in one adopting domain (`domain_id`) | one per rule and domain | `<pattern rule>-T<nn>` | any |
| `standard_rule_test` | a standard rule | any | `<standard rule>-T<nn>` | any |

Technical records have no tests of their own: each is proved by the tests of what it implements. A standard rule is proved by its standard rule tests, such as a scan of the code for what the rule forbids; the technical records that `meets` it show where it is applied, and prove nothing. A test at a level its kind does not allow is a warning.

Most kinds take `given`, `when` and `then`: the state it starts from, the action, and what it expects. A constraint test takes `accepts` and `refuses` (the values the value object takes and refuses); a flow test takes `steps` (a list, one item per step of the main path) and `expected_result`.

## Run by

Every test has a run by:

- `level`: `unit` (pure code, no storage), `database` (with real storage), `api` (over HTTP against the product's server), `contract` (against an API's or an outside system's agreed shape), `e2e-api` (end to end through the API), `e2e-ui` (end to end through the user interface) or `manual`.
- `state`: `automated` (a file runs it), `manual` (a person follows it) or `not automated yet` (meant to be automated, and not proof until it is).
- `file`: the test file, from the product root. Required when automated; give it otherwise only when the file exists.
- `manual_reason`: why a person runs it rather than a file. Required when manual, and only then; a manual test's level is usually `manual`.

- `size`: leave it out for a small test, the usual case (a few records); `volume` for one that runs on many records to show it holds at scale; `worst case` for one that runs on the slowest or largest input the product must still handle.
- `smoke`: `true` for a smoke test, one of the few run first, after a build or a deploy, to show the product works at all. Leave it out otherwise.
- `external`: `true` for a test that reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Leave it out otherwise.

The store refuses an automated test with no file, a manual reason on a test that is not manual, and a `smoke` or `external` of `false` (leave it out instead).

## Test data sets

Some tests start from prepared data: an environment, accounts and starting records, built by a seed or fixture file. Describe each such set once, as a `test_data_set` under the domain whose tests use it (ID `<P>-<D>-TD<nn>`, from `next_id` with the domain as `parent`): its `environment` (where it runs), `accounts` (who it signs in as), `records` (what it starts with), `prepare` and `reset` (how to set it up before a test and clean up after), and `file` (the seed or fixture that builds it, from the product root; a file or a folder). Then link each test that starts from it, with `starts_from` (test to data set).

A data set no test starts from is an error (`test-data-set-unused`). A data set whose file does not exist is reported too (`test-data-set-file-missing`): an error when an automated test starts from it, since that test cannot run, and a warning otherwise.

## The test names its ID

An automated test's file names the test record's ID, at the start of the test's name, so a failing test points straight at its record and the check can find it:

```ts
it('TL-LEND-INV01-T A second member with the same email is rejected, whatever its case', () => {
  // ...
});
```

When one test in code proves two records, split it into one test per record, each named with its own ID. IDs are matched whole: `TL-LEND-INV01-T` is not found in `TL-LEND-INV01-T2`.

## Automated, manual or not automated yet

Write the test with its record when you can. Use `not automated yet` (no `file`) when the code it tests is not written, or the test needs something not in place yet, such as a browser runner; say in `given`, `when` and `then` what it will check, and in `notes` why it waits. When it is written, `set` its `state` to `automated` and its `file` in one write. Use `manual` only for what code cannot sensibly check, such as a smoke test of the README's steps, with the reason.

## Examples: the Tool Library

An invariant test, a constraint test and a use case test:

```
add  { "invariant_test": { "id": "TL-LEND-INV01-T", "title": "A second member with the same email is rejected, whatever its case",
       "invariant_id": "TL-LEND-INV01", "level": "database", "state": "automated", "file": "test/domain-rules.test.ts",
       "when": "Registers a member, then another with the same email in a different case and with spaces.",
       "then": "Refused as email_taken; inserting the duplicate straight into the store also fails." } }
add  { "constraint_test": { "id": "TL-VO02-C02-T", "title": "An email address is kept trimmed and in lower case", "constraint_id": "TL-VO02-C02",
       "level": "unit", "state": "automated", "file": "test/domain-rules.test.ts",
       "accepts": "' Ada@Example.org ' as ada@example.org", "refuses": "an address with a space inside" } }
add  { "use_case_test": { "id": "TL-LEND-UC03-R04-T01", "title": "Borrowing a tool on loan or needing repair is refused with the reason",
       "uc_requirement_id": "TL-LEND-UC03-R04", "level": "api", "state": "automated", "file": "test/api.test.ts",
       "given": "One tool on loan and one needing repair", "when": "A member borrows each", "then": "Each is refused, saying which" } }
```

A test data set built by a fixture, and a test that starts from it:

```
add  { "test_data_set": { "id": "TL-LEND-TD01", "title": "An empty library and a test clock", "domain_id": "TL-LEND",
       "environment": "A fresh in-memory store.", "records": "No members, tools or loans; a clock the test sets.",
       "prepare": "Each test calls services() for a new store and clock.", "reset": "Nothing: each test has its own store.",
       "file": "test/helpers.ts" } }
link { "source": "TL-LEND-INV01-T", "relation": "starts_from", "target": "TL-LEND-TD01" }
```

An endpoint test not automated yet, then automated:

```
add  { "endpoint_test": { "id": "TL-LEND-EP05-R02-T01", "title": "Returning an unknown loan gives 404 loan_not_found",
       "api_requirement_id": "TL-LEND-EP05-R02", "level": "api", "state": "not automated yet",
       "when": "POST /loans/999/return", "then": "404 loan_not_found, and nothing changes",
       "notes": "Waits for the HTTP test harness." } }
```

Once it is written: `set { "endpoint_test": { "id": "TL-LEND-EP05-R02-T01", "state": "automated", "file": "test/api.test.ts" } }`.

A manual flow test, a pattern rule test in the domain that adopts the pattern, and a standard rule test:

```
add  { "flow_test": { "id": "TL-LEND-UC04-FL01-T", "title": "The README returns a tool against a running server", "flow_id": "TL-LEND-UC04-FL01",
       "level": "manual", "state": "manual",
       "manual_reason": "It checks what a newcomer meets: the real entry point, the documented port and the README's commands as written.",
       "steps": ["Start the server with npm start", "Borrow a tool with the README's command", "Return it with the README's command"],
       "expected_result": "The loan is returned, not late." } }
add  { "pattern_rule_test": { "id": "TL-PAT-LIBRARIAN-ACTION-R01-T01", "title": "Each librarian action missing its required input is refused",
       "pattern_rule_id": "TL-PAT-LIBRARIAN-ACTION-R01", "domain_id": "TL-LEND", "level": "api", "state": "automated", "file": "test/api.test.ts" } }
add  { "standard_rule_test": { "id": "TL-STD-CODE-R01-T01", "title": "Every error the API answers with carries a code and a sentence",
       "standard_rule_id": "TL-STD-CODE-R01", "level": "api", "state": "automated", "file": "test/api.test.ts",
       "when": "Each request the API refuses is sent.", "then": "Each answer carries an error code and a sentence." } }
```

## Rules

- One test proves one behavior: its parent. A test that seems to prove two records is two tests.
- Write an automated test record and its test together, and never mark a test automated before its file names its ID.
- Aim for every obligation to be proved; each one that is not is a gap in coverage, and a test not automated yet does not close it.
- Finish with the `check-and-fix` skill.
