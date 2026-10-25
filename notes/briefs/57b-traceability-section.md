# Brief: a Traceability section in the wiki

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 57a (relation labels) and the UI agents working in `app/src/specs/**` and the inspector have merged (briefs 52 and 53 phase 1). Work in your own worktree, and finish with your branch ready to merge.

## Goal
On a record's wiki page, Jared wants to see what's related to it, "like seeing the components & tests address a requirement".

Today the wiki body shows problems and children. The links sit only in the side facts and the inspector, as raw "Links in" and "Links out" lists grouped by relation name. Brief 57a adds `forward_label` and `reverse_label` to every relation (`RelationRule` in `lathe/src/types.ts`).

## Decisions already made (Jared)
1. **A Traceability section** in the wiki body of every record page, after the body text and before Children. It is built from the meta-model, with no special case per kind beyond the roles in `relations.csv` (`design` and `proof`) and the kind's obligation (yes, proof or no).
   - **For an obligation** (a UC requirement, domain rule, interaction requirement or pattern rule), these groups, in this order:
     - **Designed by:** the incoming `design`-role links, each component marked built or not built, as coverage counts it;
     - **Proved by:** the incoming `proof`-role links, each test showing its state (automated, manual or planned);
     - **Carried out in:** incoming `fulfills`;
     - **Applied by:** incoming `applies`;
     - then the other incoming relations, under their `reverse_label`.
   - **Gap callouts** for an obligation:
     - "Not designed yet" when the kind needs design and nothing designs it;
     - "Not built yet" when a designing component's file is missing;
     - "Not proved yet" when nothing proves it (or "only planned" when only a planned test does).
     
     Each callout reuses coverage's own judgment, so it never disagrees with the Coverage line or the checks, and links to the check that reports it (the brief 51 check pages if they've landed, otherwise the Checks page filtered to it). A pattern rule is judged per following domain: show one line per domain.
   - **For a use case:** a **requirement table**, with one row per UC requirement and the columns Requirement, Designed, Built and Proved. Each cell is a mark linking to the designing or proving records, with gaps flagged. The table is followed by Carried out in (flows), Follows (patterns) and Applies (domain rules), with each rule's own status.
   - **For a component:** Satisfies (what it designs), then Proved through (the tests proving those things, rolled up), then Uses and Used by, and the rest under their labels.
   - **For a test:** Proves, and the file that runs it, with its state.
   - **For any other kind:** its outgoing links under their `forward_label` and its incoming links under their `reverse_label`. An empty group isn't shown.
2. **Labels everywhere:** the inspector's Links out and Links in, the record facts beside the body, graph edge labels and tooltips, and the ERD's line labels all use `forward_label` and `reverse_label`. The inspector stays compact.
3. **Rows:** every listed record is a clickable row (UX-R05) showing its kind tag only when the list mixes kinds (DR144). A list is titled by its label (DR160). Long lists stay short with search (the 10-row rule). Use ghost or text actions per brief 54, if it has landed.
4. **Proactive standard:** add a Browsing domain rule, "Links are shown by their labels, never by relation codes". Prove it with a test that no rendered page shows a raw relation code ("satisfies", "proves") as a heading or label.

## Also: the test plan groups (from S2 trial 4, gap 7)
The Test plan folder's grouping (`app/src/specs/folders.ts`, briefs 37 and 52) misplaced S2's material: 143 acceptance scenarios landed in other groups, and UI tests and design checks fell into Engineering. Fix it here, since you own `app/src/specs/**`:
- **Acceptance:** a test that sits under a capability is an acceptance test, as is one that proves a UC requirement. It is grouped under that capability and its use case.
- **New groups:** add **UI tests** (`test_type` of `ui`, or a test proving an interaction requirement through a view) and **Design checks** (a test with only `supports` links, from brief 71, or a `test_type` of `design`). They sit before Engineering checks, in that order.
- **Order:** keep the one-kind and empty-group rules. Update the group order in the domain rules (DR142 and the group list) and the tests (T280 and onward).

## Records
- Use case `LA-BRW-UC118` "See what designs, proves and carries out a record" under `LA-BRW-CAP01`, with requirements.
- Domain rules, components and tests from the next free LA-BRW numbers. Check the highest first, since several briefs are adding them.
- Add the use case to a flow's `carries_out`.

## Scope
- **You own:** `app/src/specs/**` (the record page and Traceability), the inspector's link lists, the label use in `app/src/graph/**` and `app/src/model/**`, styles, tests, and the records above.
- Check which agents are running when you start, and stay out of their files beyond the label call sites.
- Never use port 5199. Use `npx vite --port 5418` in `app/` and stop it. Run brief 53's stability suite.

## Report
Use the format in 00-common-rules, with your branch and its last commit.
