# Brief: update the Claude Code plugin for the pass-4 format

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-4`.

## Goal
Teach agents the new parts of the format: interaction requirements, test states, test proof by the proved record's ID, obligation kinds and relation roles, and widening extensions.

## What to do
1. Read `lathe/FORMAT.md` (all, especially sections 3, 4, 6 and 9) and `lathe/meta/*.csv`, then `plugin/`.
2. Update `write-use-cases` (when a rule belongs in an interaction requirement instead), `design-the-domain` (interaction requirements under views, endpoints and flows, with an example), `plan-tests` (states, the two ways code can carry an ID, when to plan a test instead of writing it), and `check-and-fix` (the new error checks and the planned count). Add a short `extend-the-meta-model` skill: adding kinds and relations, widening a default kind, marking an obligation kind and a relation's role, with an example.
3. Make the hook also react to edits of a product's `metaExtensions` CSVs (check it already does) and keep it silent unless there are errors.

## Scope
You own: `plugin/**`.

## Checks
`claude plugin validate plugin` (if available), JSON files parse, and run the hook script by hand once on a clean spec file (silent).
