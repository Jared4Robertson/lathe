---
name: plan-tests
description: Write or change Lathe test records and the tests they name - automated, manual or planned. Use when planning which tests prove which requirements, domain rules and interaction requirements, when writing a test for a Lathe test record, or when deciding whether to plan a test instead of writing it, in a repo with lathe.config.json.
---

# Plan tests

A `test` record says what one test proves and how it is run. An obligation (a requirement, domain rule, interaction requirement, or a product's own obligation kind) is **proved** when an automated or manual test `proves` it, and **planned** when only a planned test does.

## The record

| Field | Meaning |
| --- | --- |
| `id` | `<P>-<D>-T<nn>`, the next free number in the domain. |
| `parent` | The domain, or, when the domain has capabilities, the capability of the use cases whose requirements it proves. A test that proves only domain rules stays under the domain. |
| `title` | What the test shows, as a sentence. |
| `test_type` | Required. For example `domain_rule`, `requirement`, `endpoint`. |
| `state` | `automated` (the default when absent), `manual` or `planned`. Any other value is an error. |
| `run_by` | The test file, as a path from the repo root. Required for an automated test; optional for manual and planned ones. |
| `links.proves` | The obligations this test proves. |

The body says what the test does: the set-up, the action and what it expects. For a manual test it is the procedure a person follows.

## The three states

- **automated**: code runs it. `run_by` must name a file that exists and mentions an ID this test carries (see below). A missing `run_by` is the error `test-run-by-missing`; a missing file is `test-file-missing`; a file that mentions neither ID is `test-file-missing-id`.
- **manual**: a person runs it, following the body. It counts as proof. Use it only for what code cannot sensibly check (a smoke test of the README's steps, a look at a printed page). If it names `run_by`, the file must exist.
- **planned**: not written yet. It shows what will prove an obligation, but it is not proof: coverage counts the obligation as **planned**, and the `unproved` warning stays. If it names `run_by`, the file must exist, so leave `run_by` out until the file is written.

## Two ways code can carry the ID

An automated test's `run_by` file must contain **either**:

1. **the test record's ID**, for example in the test's name: `it('TL-LEND-T01 A second member with the same email is rejected', ...)`; or
2. **the ID of a record the test proves**: `it('TL-LEND-DR01 Email is unique, whatever its case', ...)`. Use this when the product keys its tests by the rule they prove; the code then needs no separate test ID.

Pick one style per product and keep to it. Put the ID at the start of the test's name, so a failing test points straight at its record.

## When to plan instead of write

Write the test with the record when you can: the code under test exists, or you are writing it now. Plan it (`state: planned`, no `run_by`) when:

- the design is ready but the code it tests is not written yet;
- the test needs something not in place yet (a fixture, a browser runner, a second service);
- you are laying out what will prove a set of obligations before building them.

Say in the body why it is planned and what it will check. When the test is written, set `state` to `automated` (or remove it) and add `run_by` in the same change. Never mark a test automated before its file mentions the ID.

## Examples

An automated test keyed by its own ID:

```markdown
---
id: TL-LEND-T01
kind: test
title: "A second member with the same email is rejected, whatever its case"
parent: TL-LEND
test_type: domain_rule
state: automated
run_by: test/domain-rules.test.ts
links:
  proves: [TL-LEND-DR01]
---
Registers a member, then registers another with the same email in a different case and with spaces: refused as `email_taken`.
```

```ts
it('TL-LEND-T01 A second member with the same email is rejected, whatever its case', () => {
  // ...
});
```

A planned test of an interaction requirement:

```markdown
---
id: TL-LEND-T14
kind: test
title: Borrowing a tool on loan answers 409 tool_on_loan
parent: TL-LEND
test_type: endpoint
state: planned
links:
  proves: [TL-LEND-E04-R01]
---
Planned: the HTTP test harness is not set up yet. Will borrow a tool, borrow it again as another member, and expect `409 { "error": "tool_on_loan" }` with no second loan created.
```

## Rules

- Write an automated test record and its test together.
- One test proves one behaviour. It may prove several records when they are one behaviour (an interaction requirement, the use case requirement it fulfills, and the domain rule behind them).
- Quote a title that contains a colon or starts with a special character.
- Aim for every obligation to be proved; each one that is not is a warning and a gap in coverage, and a planned test does not clear it.
- Finish with the `check-and-fix` skill.
