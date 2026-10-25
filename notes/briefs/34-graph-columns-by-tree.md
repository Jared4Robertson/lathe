# Brief: graph columns follow the tree, so siblings line up

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `graph-columns`.

## Goal
Jared: "in the graph, every sibling should be in the same column spatially, instead of some siblings being further left or further right." Today a node's column comes from its kind's tier, so the children of one record (or the groups under it) spread across several columns by kind (for example, under a domain, Aggregates and Capabilities sit in one column and Components, Endpoints and Tests further right). Columns must follow the actual tree instead.

## Decisions
- **A column is a depth in the parent/child tree around the focus**, read left to right: the focus's ancestors one column each to its left (root furthest left); the focus; its children, or the group nodes over them, in the next column; their members in the next; and so on. Every node with the same parent (record or group) is in the same column, whatever its kind.
- **Cross-linked records** (reached by satisfies, proves, fulfills, uses, follows and the rest, not by the parent/child spine) go in the column after the record they are reached from, by the shortest path from the focus; when a record is both a tree descendant and cross-linked, its tree position wins.
- **Groups** keep their own column between a parent and its members, as now.
- **Order within a column** stays stable: by parent's position first, then kind order, then ID, so re-centring is predictable.
- **Trace mode** is unchanged: its chain (obligation, what fulfills it, components, tests, files) reads left to right in its own columns.
- The same-tier cycle fallback becomes unnecessary for tree columns; keep the radial fallback only if some graph genuinely cannot be laid out (say when), or remove it if never needed, and update its records.

## What to do
1. Change `app/src/graph/model.ts` (column assignment) and `app/src/graph/layout.ts` (ELK partitions from columns) accordingly; keep the left-to-right direction and everything else (groups, filters, keyboard order, trace).
2. Tests in `app/test/graph/`: siblings of mixed kinds share a column; ancestors left, descendants right; a cross-linked record sits one column after its source; groups between parent and members; order within a column; trace mode unchanged. Update existing graph tests whose expectations were tier-by-kind.
3. Lathe's own spec: update `LA-BRW-UC20-R08` (tiers by kind become columns by tree depth) and the graph records that describe tiers (`LA-BRW-C20`, `C21`, `V20`, `T63`, `T64`, and others you find), and add a domain rule "siblings share a column" in `LA-BRW-DR120`–`DR129` with tests `LA-BRW-T250`–`T259`, applied by `LA-BRW-UC20`. All satisfied and proved.

## Scope
You own `app/src/graph/model.ts`, `app/src/graph/layout.ts`, `app/test/graph/**` and the spec records above. Another agent is changing the rest of `app/**` (the nav and shortcut hints) in parallel: do not touch other app files. Never use port 5199; if you look at the app, use `npx vite --port 5401` in `app/` and stop it.

## Checks
`cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (0 errors).
