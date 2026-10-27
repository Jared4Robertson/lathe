# Brief: the schema and store for the new domain model (step 1)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/domain-model-refinement.md](../plans/domain-model-refinement.md) and the store's interfaces [notes/store-interfaces.md](../store-interfaces.md) first. **Base branch: `domain-model`**, the integration branch for this hard cutover, not `main`. Work in your own worktree from it, and finish with your branch ready to merge into `domain-model` (merge `domain-model`, not `main`, into your branch before you report).

## Goal
The plan replaces Lathe's kinds with fifty concrete kinds from DDD, CQRS and event storming, each record with exactly one parent. This step rewrites the schema and adapts the store, so that the data of every product can be written in the new shape. The Tool Library is converted by hand on top of your branch next, then LA, the engine, the writers and the app, in parallel. Make the interfaces clear and documented.

## Decisions (Owner, from the plan; apply them)
The plan's Decisions and Scope are the specification: its kind table (parent, links, ID pattern), its rules on enforcement, the field types, the table storage and keys, the run by, and the obligations. Apply them exactly. In particular:
- **Hard cutover.** Rewrite the stage files in `lathe/schema/` (renumber freely; fold 013 to 015 into the files they change). There are no upgrade migrations: the database is rebuilt from the data files on every load. Delete every table, relation and column the plan removes: `domain_rule`, `component`, `layer`, `design_flow`, `design_step`, `api`, `api_shape`, `interaction_requirement`, `use_case_step`, the generic `test`, and the links `proves`, `satisfies`, `implements`, `carries_out`, `applies`, `involves`, `reacts_to`, `raised_by`, `relates_to`, `uses` and any other the new model replaces.
- **Stages** become `domain-model`, `use-cases`, `interaction-design`, `technical-specification` and `test-plan`, in that order, with each kind's `position` following the plan's order within its stage. Product and role sit outside the stages.
- **One parent per record.** A parent may be one of two kinds where the plan says so: an endpoint under a command or a query, a table under an entity or a read model. Exactly one of the two columns holds a value.
- **Kinds with no owner** (value object, specification, view, integration, UI component) have no parent column. Their product, and a specification's domain, follow from the ID prefix; validate that the prefix names a real product (and domain), and that their links stay inside it (a specification's aggregates all in its ID's domain).
- **Refusals** are constraints or validation queries in the write transaction, as the plan's "How rules are enforced" lists them. "At least one" minimums and "nothing uses it" are **not** refusals; the engine step adds them as checks. Don't add those checks.
- **Fields.** `entity_field`, `event_field` and the new `read_model_field` share one shape. A field's type is exactly one of: a basic type from the fixed enum (text, whole number, decimal, date, time, yes/no), a value object, or a reference to an aggregate. A same-domain aggregate reference and the table's foreign keys line up; a reference to another domain's aggregate is allowed.
- **Tables** have a storage enum (`table`, `view`, `materialized view`); an entity's table is always `table`. Keys are part rows: primary, unique, foreign and index, with their columns, a unique key's optional invariant and a foreign key's target table.
- **Tests** carry a run by: a level enum (unit, database, api, contract, e2e-api, e2e-ui, manual), a state enum (automated, manual, not automated yet), a file (required when automated) and a manual reason (required when manual). Give each test kind the content fields its kind needs (for example given, when and then; a flow test's steps and expected result); decide them and list them.
- **Supertypes.** `obligation` covers constraint, invariant, specification, policy, domain service, UC requirement, view requirement, API requirement, pattern rule and standard rule. Add others only where a relation needs one.
- **Keep** patterns, pattern rules and settings, standards and their rules, roles, open questions (under a product or a domain, with an optional `about` link to any record), product kinds (update the parent kinds they may use), the check table, the registry, the merge driver and the file format.
- **The schema description,** `tables.ts` (via `npm --prefix lathe run schema`) and `notes/db-first-interfaces.md` are updated to match. Rename that note to `notes/store-interfaces.md`, and update every link to it.

## Owns
`lathe/schema/`, `lathe/src/store/`, `lathe/test/store/`, the store's fixture, and the interfaces note. Do not touch `lathe/src` outside the store, `lathe/data/`, `data/`, `examples/`, `app/`, `desktop/` or the plugin.

## Expected breakage
Your branch can't pass the full checks: LA's and the Tool Library's data are in the old shape and won't load, and the engine, checks, app and writers still name old tables. That's expected; later steps fix them on the integration branch. Instead:
- `npm --prefix lathe run typecheck` must pass for the store and anything it exports. If an engine file outside the store fails to typecheck only because a generated type changed, list it; don't fix it.
- The store's own tests pass: `npx vitest run test/store` in `lathe/`, with at most 2 workers.
- Knip for lathe, run once; list findings caused only by the code you don't own.

## Checks (unit tests)
- Each kind loads a good row and refuses a bad parent, a duplicate ID, a bad enum value and a missing required field.
- Each refusal in the plan: a step fulfilling another use case's requirement; a policy hearing another domain's unpublished event; a command and a specification in different domains; a query and its read model in different domains; an endpoint or table with both or neither parent; more than one flow per use case; a second invariant test for one invariant; a field with two types; a link across products; an ownerless record whose prefix names no product or domain.
- Deterministic files: write, reload and write again gives identical bytes.
- Each command (add, set, move, link, unlink, remove) on the new kinds, and the merge driver on the new tables.

## Report
Follow the common rules' report, plus:
- every table with its columns, as one compact table;
- the supertypes and their members;
- the validation queries and what each refuses;
- the interfaces later steps call, as signatures;
- each test kind's content fields;
- every decision you made, one line each.
