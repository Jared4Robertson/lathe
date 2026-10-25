# Brief: domain events in the wiki, ERD and graph

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after briefs 58 and 59 (events in the engine and the data), 56 (graph) and 57b (Traceability) have merged. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Show domain events: the `domain_event` kind under aggregates, with `raised_by` and `reacts_to` (see FORMAT and REFERENCE after brief 58).

## Decisions already made (Jared)
1. **Wiki:**
   - An aggregate's page lists its domain events, titled "Domain events" (DR160).
   - An event's page shows its Fields table, like an entity's.
   - In Traceability (brief 57b), use the relation labels from `relations.csv`: an event shows "Raised by" and "Reacted to by", and a reacting record shows "Reacts to".
2. **ERD (Model view, `app/src/model/**`):**
   - On an aggregate's ERD, each event is a rounded pill beside its aggregate's entities, in the spark colors (as the old Diagrams pages draw `domain_event`). A short line runs from the entity that raises it, where `raised_by` is set. Reacting aggregates, from this or another domain, appear as gray or faded context with a dashed "reacts to" line.
   - On a domain's ERD, dashed "reacts to" lines between aggregates show cause and effect: aggregate A raises an event, aggregate B reacts. One line per aggregate pair and event, with the event's name as the line's label on hover.
   - The key explains the pill and the dashed line.
3. **Graph:** events sit under their aggregate through a "Domain events" folder, by the one-kind rule. `reacts_to` edges are dashed, use their labels, and appear with the Links switch (brief 56).
4. **Style:** tokens (spark for events), clickable rows (R13), hover states (R08), motion (R12) and the stability budget (R17).

## Records
Requirements under `LA-BRW-UC113` (the ERD) and `UC118` (Traceability), and the graph's UC20, from the next free numbers, with domain rules, components and tests from the next free LA-BRW numbers.

## Scope
- **You own:** `app/src/model/**`, the event parts of `app/src/specs/**` and `app/src/graph/**`, styles, tests, and the records above.
- Check which agents are running when you start, and stay out of their files beyond these.
- Never use port 5199. Use `npx vite --port 5419` and stop it. Run the stability suite.

## Report
Use the format in 00-common-rules, with your branch and its last commit.
