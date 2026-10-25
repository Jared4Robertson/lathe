---
id: LA-PAT-APP-UX
kind: pattern
title: App experience
parent: LA
---
How the web app behaves for the person using it, so that every page feels the same to the hand and the eye: what shows a hover, how the workbench's panels sit and resize, what the page bar and each pane's header hold, how things move, how a row leads to its record, how every open thing keeps an address, how it all works by touch, that nothing jumps, that actions look like actions, and that it stays within its performance budgets. The app lives in `app/src`; Browsing (`LA-BRW`) follows this pattern for all of it. How the code itself is written (layout in markup, classes, tokens, generic components, labels, names and spelling) is the App code pattern, `LA-PAT-APP-CODE`.

## How a domain uses the pattern

The domain links the pattern with `follows`. The pattern has no settings: every rule applies to all of the domain's pages. Each rule is proved by a test in `app/test` that reads the source or renders the main pages, and that names the file and line to fix when it fails. `LA-PAT-APP-UX-R08` is proved in a real browser by the stability suite (`app/stability`, `npm --prefix app run test:stability`), and at the source by `app/test/nothing-jumps.test.tsx`. `LA-PAT-APP-UX-R30` is proved on the production build by the performance suite (`app/perf`, `npm --prefix app run test:perf`).

## Rules

- `LA-PAT-APP-UX-R01`: everything clickable shows a hover state.
- `LA-PAT-APP-UX-R02`: the workbench, panels a gap apart and every gap resizes.
- `LA-PAT-APP-UX-R03`: the page bar holds the page's tabs and layout controls; each pane's header holds only that pane's actions.
- `LA-PAT-APP-UX-R04`: motion is shared and optional.
- `LA-PAT-APP-UX-R05`: a row or card that leads to one record is one link.
- `LA-PAT-APP-UX-R06`: every open thing has an address.
- `LA-PAT-APP-UX-R07`: everything works by touch.
- `LA-PAT-APP-UX-R08`: nothing jumps.
- `LA-PAT-APP-UX-R09`: actions look like actions.

New rules continue from UX-R10.
