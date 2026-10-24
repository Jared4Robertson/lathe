---
name: check-and-fix
description: Run lathe check, fix every error it reports, and report warnings and coverage. Use after changing any Lathe spec record or meta-model file, before committing spec changes, or when asked whether the specs are consistent or how much is designed, built, proved and planned.
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
| `bad-test-state` | Set `state` to `automated`, `manual` or `planned` (or remove it for automated). |
| `test-run-by-missing` | An automated test needs `run_by`. Add the file, or set `state: planned` if the test is not written yet. |
| `test-file-missing` | Fix `run_by`. For a manual or planned test whose file does not exist yet, remove `run_by`. |
| `test-file-missing-id` | If the test has a `key`, put that exact text in the file (or fix the key). Otherwise the test proves nothing: put its ID in the test's name, and add the `proves` links it should have. |
| `proof-not-in-file` | The file names neither the test's ID nor the proved ID in the message. Put the test's ID in the test's name, or name every ID it proves. If the test does not really prove that record, remove the link. |
| `meta-duplicate-kind` | One meta-model folder defines a kind twice. Merge the two rows. (A row in `metaExtensions` for a default kind is allowed: it widens that kind.) |
| `meta-duplicate-relation` | Remove the repeated relation row. |
| `meta-unknown-parent-kind`, `meta-unknown-relation-kind` | Define the kind it names, or fix the name, in the meta-model CSV. |
| `meta-bad-required-field` | Use a field name of lower-case letters, digits and underscores, and not `id`, `kind`, `title`, `parent` or `links`. |
| `bad-fitness-date`, `bad-fitness-score` | A fitness record needs `date: YYYY-MM-DD` and a `score` from 1 to 5. |
| `capability-order` | Give each capability in the domain its own whole-number `order` (`1` and `01` are the same). Renumbering an order is fine; it is not an ID. |
| `pattern-setting-missing` | Add the setting to the use case as a header field named exactly as the pattern lists it, with a value or `"Not applicable: <reason>"`. If the use case does not really share the pattern, remove the `follows` link instead. |
| `bad-pattern-settings` | Rename the pattern's setting to lower-case letters, digits and underscores, not `id`, `kind`, `title`, `parent` or `links`, and rename the field in every use case that follows it. |
| `parse-error` | Fix the YAML header: `---` lines, indentation, quotes around titles with colons. |

Fix the record that is wrong, not the one that reports it: a dangling link is usually a typo in the link, not a missing record. Never change the meta-model to make an error go away unless the user asked for a new kind or relation (see `extend-the-meta-model`).

## Warnings: work still to do

Warnings do not fail the check. They are gaps: an obligation (a requirement, domain rule, interaction requirement, or a product's own obligation kind) that nothing designs (`unsatisfied`) or no automated or manual test proves (`unproved`), a use case without requirements, a component whose file does not exist yet, a use case left directly under a domain that has capabilities (`use-case-outside-capability`: move it under its capability by changing its `parent`), or a use case following two patterns that share a setting name (`pattern-setting-clash`: rename the setting in one pattern). A planned test does not clear `unproved`. Fix the ones your task is about; leave the rest and mention them.

## Coverage

Coverage has one line per domain and obligation kind, with four counts out of the total:

- **designed**: a `design` link (by default a component's `satisfies`) targets it;
- **built**: a component whose file exists designs it;
- **proved**: an automated or manual test `proves` it (any `proof` relation);
- **planned**: not proved, but a planned test is meant to prove it.

A planned obligation has a test still to write; one neither proved nor planned has no test at all.

## Report

Say, in a few lines:

1. Whether the check passes (the last line: `N errors, M warnings.`).
2. Each error you fixed and how.
3. The coverage lines for each domain you touched (designed, built, proved and planned for each obligation kind, as `lathe check` prints them), and the warnings your change added or cleared.
4. Any planned tests your change added, and why they are planned.
