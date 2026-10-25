# Brief: entities in the engine

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge, as the common rules say.

## Goal
Jared wants an ERD (entity-relationship diagram) of each domain at aggregate level, and one of each aggregate's own records, like S2_sandbox's domain model. Never open any `.env*` file there, and copy no S2 text or names into Lathe.

S2 models each aggregate as a root record and child records. Each record has fields, and the references between records are one ERD edge each. The read-only reference is `~/Development/S2_sandbox/docs/sdlc/01-define/02-domain-model/` (`domain-model.std.md`, `aggregate.tmpl.md`).

Lathe gets an `entity` kind for this. Lathe's word "record" already means any spec record, hence "entity".

## The contract (committed in 757e991; do not change it)
- `kinds.csv` has `entity`: in the define stage and the domain-model folder, under an `aggregate`, requiring `role`.
- `relations.csv` has three entity-to-entity links: `has_one` (one to one, a part), `has_many` (one to many, parts) and `refers_to` (many to one, a reference that may cross aggregates and domains).
- `types.ts` has `SpecRecord.entityFields?: EntityField[]`, where `EntityField` is `{ field, meaning, kind, example }`.

## Decisions already made (Jared, and the coordinator's recommendations)
- **Entity IDs** are `<domain>-EN<nn>`, for example `TL-LEND-EN01`. (`-E` is taken by endpoints.)
- **`role`** is `root` or `child`. An aggregate that has entities has exactly one root.
- **Fields** live in the entity's body as a Markdown table under a `## Fields` heading, with the columns Field, Meaning, Kind of value and Example, one row per field and each field name used once. The engine reads them into `entityFields`, in table order.
- **Checks** (new files from 66), each with its message naming the fix:
  - `entity-role` (error): `role` must be root or child.
  - `aggregate-root` (error): an aggregate with entities must have exactly one root.
  - `entity-fields` (error): a `## Fields` table is missing, has the wrong columns, or repeats a field name.
  - `has-crosses-aggregate` (error): `has_one` and `has_many` must stay inside one aggregate, because parts belong to their aggregate. Only `refers_to` may cross.
  - `entity-unreferenced` (warning): a child entity that no `has_one` or `has_many` reaches from its aggregate's root, directly or through other children.
  - `too-many-children` already covers size.
- **Docs:**
  - A new FORMAT section 17, "Entities and the ERD": the kind, the ID, `role`, the Fields table, the three relations with their cardinalities, the checks, and how the app draws the ERD. The app part: the domain ERD at aggregate level, with lines from `refers_to` links that cross aggregates, falling back to `relates_to`; each aggregate's ERD shows its entities and the entities they refer to elsewhere.
  - Update the sample workspace (one aggregate with a root and a child, and a `refers_to`), the README, and the plugin skill that writes the domain model (`plugin/skills/design-the-domain`).

## Lathe's own spec (LA-CHK)
- Use case `LA-CHK-UC24` "Model each aggregate's entities and how they relate" under `LA-CHK-CAP03`, with requirements.
- Domain rules from `LA-CHK-DR180`, components from `LA-CHK-C170` and tests from `LA-CHK-T290`. Put components in the right `LA-CHK-LAY*` layer. Put domain rules in a fitting aggregate, or a new one, keeping each aggregate at 15 rules or fewer.
- Add the use case to `F03`'s `carries_out`. Everything satisfied and proved.

## Scope
- **You own:** `lathe/**` (except the contract files), `plugin/skills/**` and the records above.
- **Working at the same time:**
  - Brief 44 writes entity records for the Tool Library and Lathe's domains.
  - Brief 45 builds the app's Model view.
  - Briefs 39 and 42 are working in `app/`.

## Report
Use the format in 00-common-rules, with your branch and its last commit (the coordinator merges).
