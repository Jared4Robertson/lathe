# Brief: domain events in the engine

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 57a (relation labels) has merged, since it also edits `lathe/`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Jared added domain events to the domain model. They come from Lathe's own foundation (`NOTES.md`: Action and Occurrence, "an unchangeable record that something happened, named in the past tense, raised by an aggregate"); S2's domain model has no such concept. The contract is committed (3aee302):
- `domain_event` sits under an aggregate, in the define stage and the domain-model folder, with no required fields;
- relations: `raised_by` (domain_event to entity), and `reacts_to` (aggregate, use_case or component to domain_event);
- IDs are `<P>-<D>-EV<nn>`.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **Fields:** an event's body has a `## Fields` table (Field, Meaning, Kind of value, Example), read into `entityFields` exactly as for entities (brief 43). The `entity-fields` check covers events too, renamed in its message to "entity or event". Prefer extending it over a new check; say which you chose.
2. **Checks** (next free numbers, with brief 50's header format and `kinds:` lines):
   - `event-unheard` (warning): nothing `reacts_to` the event. Its message says this can be fine and suggests what might react.
   - `event-tense` (warning): the title doesn't read as past tense. Use a heuristic: the last word, or the word after the subject, ends in "-ed" or is a known irregular past form ("sent", "paid", "made", "held", "done", "run", "built", "lost", "won", "sold", "bought", "taken" and similar). Keep the list in the check and document it.
   - `raised-by-outside-aggregate` (error): `raised_by` must target an entity of the event's own aggregate.
3. **Docs:** add domain events to FORMAT.md's concepts, in the entities and ERD section or a new short section. Regenerate `REFERENCE.md`. Update the sample workspace (one event with `raised_by` and a `reacts_to`) and the plugin skill `model-a-domain`.
4. **Records (LA-CHK):** a use case "Model the domain events each aggregate raises", or a requirement under `LA-CHK-UC24` (entities), with domain rules, components and tests from the next free numbers. Check the highest IDs first. Keep aggregates and layers at 15 or fewer.

## Scope
- **You own:** `lathe/**`, `plugin/**` and the records above.
- **Working at the same time:** brief 59 writes the event records, and the app agents are in `app/src`.

## Report
Use the format in 00-common-rules, with your branch and its last commit.
