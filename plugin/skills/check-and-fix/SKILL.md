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
| `layer-order` | Give each layer in the domain its own whole-number `order` (`1` and `01` are the same), as for capabilities. |
| `pattern-setting-missing` | Add the setting to the use case as a header field named exactly as the pattern lists it, with a value or `"Not applicable: <reason>"`. If the use case does not really share the pattern, remove the `follows` link instead. |
| `bad-pattern-settings` | Rename the pattern's setting to lower-case letters, digits and underscores, not `id`, `kind`, `title`, `parent` or `links`, and rename the field in every use case that follows it. |
| `parse-error` | Fix the YAML header: `---` lines, indentation, quotes around titles with colons. |

Fix the record that is wrong, not the one that reports it: a dangling link is usually a typo in the link, not a missing record. Never change the meta-model to make an error go away unless the user asked for a new kind or relation (see `extend-the-meta-model`).

## Warnings: work still to do

Warnings do not fail the check. They are gaps: an obligation (a requirement, domain rule, interaction requirement, or a product's own obligation kind) that nothing designs (`unsatisfied`) or no automated or manual test proves (`unproved`), a use case without requirements, a component whose file does not exist yet, a use case left directly under a domain that has capabilities (`use-case-outside-capability`: move it under its capability by changing its `parent`), a component left directly under a domain that has layers (`component-outside-layer`: move it into its layer by changing its `parent`), or a use case following two patterns that share a setting name (`pattern-setting-clash`: rename the setting in one pattern).

Two warnings say a level of the spec is the wrong size:
- `too-many-children`: a record has more children of one kind than `structure.maxChildren` in `lathe.config.json` (default 15). Add a level between them: a capability for use cases or flows, a layer for components, another aggregate for domain rules. Tests are never counted. Moving a record changes only its `parent`, never its ID.
- `lone-child`: a capability or a layer holds only one record. Merge it into a neighboring capability or layer, or give it more.

Do not raise `structure.maxChildren` to silence the warning unless the user asks. A planned test does not clear `unproved`. Fix the ones your task is about; leave the rest and mention them.

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

## Structural warnings

These warnings say where two stages do not join up yet. Fix the link, not the check:

| Warning | Fix |
| --- | --- |
| `rule-not-applied` | Add the rule to `applies` on each use case that relies on it. If no use case does, ask whether the rule is still needed. |
| `use-case-without-flow` | Add the use case to `carries_out` on the flow that walks through it, or write that flow (see `design-the-domain`). Only reported once the domain has a flow. |
| `interaction-requirement-fulfills-nothing` | Add `fulfills` with the use case requirement or domain rule it carries out at its view, endpoint or flow. |
| `test-type-mismatch` | A `domain_rule` test proves domain rules and an `acceptance` test proves requirements. Correct the `test_type`, or the `proves` links if they name the wrong record. |

One mistake gives one error: a duplicated ID is reported as `duplicate-id`, without an error for each link to it, so fix the duplicate first and re-run the check. A relation rule restated in a product's `metaExtensions` `relations.csv` is the same rule, so only a rule listed twice in one file is `meta-duplicate-relation`.

## Pattern rules and citations

| Problem | Fix |
| --- | --- |
| `pattern-rule-setting-unknown` (error) | The rule's `setting` must be one of its pattern's `settings`. Fix the name, or add the setting to the pattern. |
| `unsatisfied` / `unproved` naming a pattern rule "in <domain>" | That domain follows the pattern, so a component in it must `satisfies` the rule and a test in it must `proves` it. Proof from another domain does not count. |
| `pattern-not-followed` | No use case follows the pattern, so its rules are owed nowhere. Link the use cases that behave this way with `follows`, or remove the pattern. |
| `obligation-outside-domain` | The obligation sits above every domain, so no domain owes it. Move it under a domain (or under a pattern, for a shared rule). |
| `unknown-id-in-prose` | The body cites an ID that is not a record: correct it to the current ID, or remove the citation. |

## Flow steps and product checks

| Problem | Fix |
| --- | --- |
| `flow-step-order` (error) | Give each step of a flow a different whole number in `order`. |
| `flow-step-fulfills-outside-flow` | The step fulfills something the flow does not carry out. Link the use case to the flow with `carries_out`, or move the step's `fulfills` to the flow that really does it. |
| `flow-fulfills-differs-from-steps` | Once a flow has steps, put each `fulfills` on the step that does it; drop it from the flow, or add the step. |
| `product-check-name-clash` (error) | Rename the product's check file so its name differs from Lathe's checks. |
| `product-checks-missing` (error) | `lathe.config.json` names a `checks` folder that does not exist: create it or fix the path. |
| Any other check name you do not recognize | It is the product's own check (in the folder `lathe.config.json` names in `checks`); read that SQL file to see what it wants. |

## Owed and silent proofs

These warnings say where proof is still owed, or where a test's proof is counted nowhere:

| Warning | Fix |
| --- | --- |
| `proof-still-owed` | The obligation is proved, but a planned test is still meant to prove it too. Write that test (and drop its `state: planned`), or remove its `proves` link if the existing proof is enough. Leave it if the planned test is real work still to do, and mention it. |
| `proof-counts-nowhere` | No domain counts anything the test proves; the message says why for each target. Link the test to what its own domain owes, move the test into the domain that owes the target, make that domain follow the pattern, or move an obligation outside every domain under one. |
| `manual-test-file-silent` | The manual test's `run_by` file never mentions it. Name the test's ID (or an ID it proves, or its `key`) in the steps that file gives, or point `run_by` at the file that really carries the test out. |
