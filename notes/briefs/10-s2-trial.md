# Brief: trial Lathe on a slice of S2

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-3`.

## Goal
Find out where Lathe's format and meta-model strain on a real, mature product, by expressing one slice of S2_sandbox's specifications as Lathe records and checking them. The output is a findings report that drives the next changes to Lathe.

## Confidentiality
S2_sandbox is a client product. Its content must not enter the Lathe repo, which has a GitHub remote. So:
- Build the trial **outside the repo**, in a scratch folder under `/private/tmp/claude-501/` (create your own subfolder), as its own product repo with `lathe.config.json`, installing Lathe from source (`node <Lathe>/lathe/bin/lathe.ts check --root <trial>`).
- The report in the repo may name S2's structures, record kinds, ID patterns and counts, and quote short generic phrases, but must not copy requirement text, business rules, or names of clients or partners.
- Read S2 read-only. Never open any `.env*` file.

## Scope
- Read first: `lathe/FORMAT.md`, `lathe/meta/*.csv`, `lathe/README.md`; then in `~/Development/S2_sandbox/docs/`: `sdlc/00-shared/` (what S2's documents are), and the Accounting domain `specs/08-accounting/` (domain model, use cases, interaction design, technical specification, test plan, traceability).
- You own: `notes/trials/**` (new) in the repo, and your scratch folder.

## What to do
1. Pick one slice of Accounting end to end: one or two aggregates with their domain rules, one or two use cases with their requirements, the interaction design and technical-spec components that satisfy them, and the tests that prove them. Express it as Lathe records in your scratch product. Where S2 has something Lathe cannot express, use a `metaExtensions` folder in the trial to add kinds or relations, and note each one.
2. Run the check, and compare its coverage with S2's own traceability for the same slice.
3. Write `notes/trials/s2-accounting.md`: what mapped cleanly; what needed a meta-model extension (and whether it belongs in Lathe's defaults); what Lathe could not express at all (for example value tables, permissions, flows' step tables, IDs that cite other IDs inside prose); how S2's quality checks compare with Lathe's; and a short, prioritised list of recommended changes to Lathe, each with its reason. Keep the scratch folder; give its path in the report.

## Checks
The trial's `lathe check` result, and confirm with `git status` that nothing outside `notes/trials/` changed in the repo.
