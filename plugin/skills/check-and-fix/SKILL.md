---
name: check-and-fix
description: Run lathe check, fix every error it reports, and report warnings and coverage. Use after changing any Lathe spec record or meta-model file, before committing spec changes, or when asked whether the specs are consistent or how much is designed, built and proved.
---

# Check and fix

`lathe check` loads every record, checks it against the meta-model, and prints errors, warnings and coverage. It exits 1 if there is any error.

## Run it

From the repo root (the folder with `lathe.config.json`):

- In a product repo: `npx lathe check`
- In the Lathe repo itself: `npm --prefix lathe run check`

Add `--json` for the whole workspace as JSON (records, links, problems, coverage) when you need to look something up.

The plugin's hook already runs the check after each edit to a spec record and shows you any errors. Run it yourself before you report or commit, because the hook does not show warnings or coverage.

## Errors: fix them now

An error means the specs are broken. Do not leave one behind.

| Check | Usual fix |
| --- | --- |
| `duplicate-id`, `bad-id` | Give the record a new, unused ID in the right pattern. Never renumber an existing record. |
| `unknown-kind` | Use a kind from the meta-model's `kinds.csv`. |
| `missing-title`, `missing-parent`, `missing-required-field` | Add the field. Required fields per kind are in `kinds.csv`. |
| `unknown-parent`, `parent-kind-not-allowed`, `product-has-parent`, `parent-cycle` | Point `parent` at an existing record of an allowed kind, so the chain ends at the product. |
| `unknown-relation`, `relation-not-allowed` | Use a relation `relations.csv` allows from this kind to the target's kind. |
| `dangling-link` | Fix the target ID, or remove the link if the target is gone. |
| `test-file-missing`, `test-file-missing-id` | Fix `run_by`, or write the test with the record's ID in its name. |
| `parse-error` | Fix the YAML header: `---` lines, indentation, quotes around titles with colons. |

Fix the record that is wrong, not the one that reports it: a dangling link is usually a typo in the link, not a missing record. Never change the meta-model to make an error go away unless the user asked for a new kind or relation.

## Warnings: work still to do

Warnings do not fail the check. They are gaps: a requirement or domain rule that no component satisfies (`unsatisfied`) or no test proves (`unproved`), a use case without requirements, a component whose file does not exist yet. Fix the ones your task is about; leave the rest and mention them.

## Report

Say, in a few lines:

1. Whether the check passes (the last line: `N errors, M warnings.`).
2. Each error you fixed and how.
3. The coverage line for each domain you touched, for example `TL-LEND: requirements 16/16 satisfied, 16/16 proved; rules 10/10 satisfied, 10/10 proved; 0 gaps`, and the warnings your change added or cleared.
