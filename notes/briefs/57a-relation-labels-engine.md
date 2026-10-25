# Brief: readable relation labels in both directions (engine)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Jared wants a Traceability section in the wiki: Designed by, Proved by, Carried out in, Applied by, gap callouts, and a use case's requirement table (brief 57b, the app). Every place that shows a link should use the same readable words: the wiki, the inspector, graph edge labels and the generated format reference (brief 50).

This brief adds those words to the meta-model, as data.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **Two new columns in `lathe/meta/relations.csv`**, `forward_label` and `reverse_label`. They are the plain words read from the source ("Satisfies") and from the target ("Designed by"). Fill every relation:
   - satisfies: Satisfies / Designed by
   - proves: Proves / Proved by
   - fulfills: Carries out / Carried out in
   - applies: Applies / Applied by
   - uses: Uses / Used by
   - follows: Follows / Followed by
   - carries_out (flow to use case): Carries out / Carried out by flow
   - implements, depends_on and relates_to: choose plain words
   - about: About / Questions about this
   - has_one: Has one / Part of
   - has_many: Has many / Part of
   - refers_to: Refers to / Referred to by
   - every other row likewise, in sentence case and American English.
   
   An extension may set or override the labels, merged the same way kinds are (FORMAT section 9).
2. **The contract:** `RelationRule` in `lathe/src/types.ts` gains `forward_label: string` and `reverse_label: string`. Update the sample workspace and the app's test fixtures that build relation rules, typing only (add the two fields). Coordinate through the code: brief 57b uses them.
3. **New check `relation-unlabeled` (error),** from the next free check number. It fires when a relation, including an extension's, lacks either label. Give it the standard header (brief 50's format). It sits beside `undocumented`.
4. **The reference:** the generated reference (`formatReference`, `lathe format`, `lathe/REFERENCE.md`) shows both labels for each relation, and lists the kinds' relations in and out by their labels. Regenerate `REFERENCE.md`, which its staleness test enforces.
5. **The CLI:** where `lathe check` or coverage output names a relation for a person (gap messages such as "nothing satisfies it"), consider the labels. Keep check codes and machine output unchanged, and keep messages stable unless a label makes one clearly better; list any you change.

## Lathe's own spec (LA-CHK)
- A requirement under `LA-CHK-UC25` (the reference) or a new use case under `CAP03`, saying relations carry labels in both directions, from the next free R number.
- Domain rules from the next free LA-CHK DR, components from the next free C, tests from the next free T. Check the highest IDs first, since briefs 43 and 50 used up to DR195, C187 and T309.

## Scope
- **You own:** `lathe/**` (including `meta/relations.csv`, `types.ts` and the sample), the typing-only fixture updates in `app/test/**`, and the records above.
- **Working at the same time:** brief 52 (mobile) and brief 53 phase 1 (jitter) are in `app/src`. Stay out of it.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and the full table of labels.
