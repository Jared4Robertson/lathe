# Brief: group nodes in the graph (domain, then "Use cases", then each use case)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-4`.

## Goal
Jared wants the graph to read like a folder tree: **domain → Use cases → UC01**, instead of a domain linking straight to every use case. Add group nodes between a record and its children, one per kind of child, so large sets of children are folded away until opened.

## What to do
1. **Group nodes:** for any record whose children (records whose `parent` is it) include more than one kind, or more than a handful of one kind, put a group node per child kind between the record and those children: labelled with the kind's plural label and a count, such as "Use cases (5)", "Aggregates (3)", "Endpoints (7)". Groups are not records: they have no ID in the spec, are drawn differently from records (folder-like), and carry the parent's coverage gaps and problems as a summary mark when any member has them.
2. **Folded by default:** in the ego graph, a group shows its count but not its members, unless the focus is inside it or the person opens it. Clicking a group opens it (its members appear in the next column); clicking again closes it. The open groups are remembered while you walk the graph. Keyboard: Enter on a group opens or closes it.
3. **Addresses:** a group can be the focus, at `/graph/<parent-id>/<kind>` (for example `/graph/TL-LEND/use_case`), showing the parent to the left and all the group's members to the right; Back works as for records.
4. **Hierarchy:** groups take their own column between the parent's tier and the children's, keeping the left-to-right layout. The parent/child spine runs record → group → record. Cross-links (satisfies, proves, ...) still go record to record.
5. **Trace mode** is unchanged (no groups in a trace).
6. Update the legend, and keep the existing tests passing (adjust them where the spine now passes through a group).
7. Tests in `app/test/graph/`, and Lathe's own spec in `specs/lathe/browsing/` using only use case `LA-BRW-UC40` with its requirements, domain rules `LA-BRW-DR40`–`DR49`, components `LA-BRW-C40`–`C49`, tests `LA-BRW-T100`–`T119`. You may edit `LA-BRW-UC20` and its requirements to match. All new obligations satisfied and proved.

## Scope
You own: `app/src/graph/**`, `app/test/graph/**`, and the spec records above. Another agent is changing `app/src/specs/**` in parallel; do not touch it, and keep any `app/src/App.tsx` or `app/src/styles.css` edit tiny (append a marked section). Never use port 5199; if you look at the app, use `npx vite --port 5390` in `app/` and stop it.

## Checks
`cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (0 errors).
