# Brief: patterns, pattern rules and prose links in the app; tidy the nav

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-5`.

## Goal
Show the pass-5 model in the app: which patterns a domain follows and how it proves their rules, the pattern pages, and record IDs in prose as links. Plus Jared's request: remove the Graph link from the side nav.

## What to build
1. **Nav:** remove the Graph item from the side nav (Jared: it no longer belongs there). The graph stays reachable from every page's Graph and Split views, Ctrl+2 and the command palette; `/graph` links keep redirecting.
2. **Domain page:** a "Patterns we follow" section (one level deep, folded like the rest): each pattern the domain follows, with its rules and, per rule, whether this domain designs, builds and proves it, or marks it not applicable (with the use case and reason). Coverage includes the `pattern_rule` line the engine now reports per domain.
3. **Pattern page** (a `pattern` record at `/records/<id>`): its settings table, its rules, and the domains and use cases that follow it, with each domain's proof status per rule.
4. **Prose links:** in rendered record bodies, every ID listed in the record's `mentions` becomes a link to `/records/<id>`, with the record's title on hover, wherever it appears in the text (not inside code). Unknown IDs (warnings `unknown-id-in-prose`) are shown with a subtle broken-link style.
5. **Graph:** pattern rules appear under their pattern; a use case's `follows` link is drawn as a cross-link.
6. Tests (vitest, testing-library) and Lathe's own spec: use case `LA-BRW-UC60` under `LA-BRW-CAP01`, with requirements, domain rules `LA-BRW-DR70`–`DR79`, components `LA-BRW-C70`–`C79`, tests `LA-BRW-T160`–`T179`. Update `LA-BRW-UC51`'s records if the nav change affects them. All satisfied and proved.

The engine adds `mentions` and pattern-rule coverage in parallel: build against `lathe/src/types.ts` and your own test fixtures; treat missing `mentions` as an empty list.

## Scope
You own `app/**` and the spec records above. Never use port 5199; if you look at the app, use `npx vite --port 5397` in `app/` and stop it.

## Checks
`cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (0 errors).
