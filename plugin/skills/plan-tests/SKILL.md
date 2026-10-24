---
name: plan-tests
description: Write or change Lathe test records and the tests they name. Use when planning which tests prove which requirements and domain rules, or when writing a test for a Lathe test record, in a repo with lathe.config.json.
---

# Plan tests

A `test` record says what one test proves and which file runs it. A requirement or domain rule is **proved** when a test `proves` it. Lathe checks that the named file exists and mentions the test's ID.

## The record

| Field | Meaning |
| --- | --- |
| `id` | `<P>-<D>-T<nn>`, the next free number in the domain. |
| `parent` | The domain. |
| `title` | What the test shows, as a sentence. The test's name in code is the ID followed by this title. |
| `test_type` | Required. For example `domain_rule`, `requirement`, `endpoint`. |
| `run_by` | Required. The test file, as a path from the repo root. |
| `links.proves` | The requirements and domain rules this test proves. |

The body says what the test does: the set-up, the action and what it expects.

## Example

```markdown
---
id: TL-LEND-T01
kind: test
title: "A second member with the same email is rejected, whatever its case"
parent: TL-LEND
test_type: domain_rule
run_by: test/domain-rules.test.ts
links:
  proves: [TL-LEND-DR01]
---
Registers a member, then registers another with the same email in a different case and with spaces: refused as `email_taken`.
```

And in `test/domain-rules.test.ts`:

```ts
it('TL-LEND-T01 A second member with the same email is rejected, whatever its case', () => {
  // ...
});
```

## Rules

- Write the test record and the test together. A `run_by` file that is missing, or that does not contain the test's ID, is an **error**.
- Put the ID at the start of the test's name, so a failing test points straight at its record.
- One test proves one behaviour. It may prove several records when they are one behaviour (a requirement and the domain rule behind it).
- Quote a title that contains a colon or starts with a special character.
- Aim for every requirement and domain rule to be proved; each one that is not is a warning and a gap in coverage.
- Finish with the `check-and-fix` skill.
