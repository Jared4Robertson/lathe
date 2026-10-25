---
id: LA-PAT-APP-UX-R10
kind: pattern_rule
title: Every page passes the accessibility audit
parent: LA-PAT-APP-UX
---
Every page and state the app draws MUST pass the accessibility suite (`app/a11y`, run by `npm --prefix app run test:a11y`), with no finding:

- **The audit:** axe-core at WCAG 2.2 AA on the product, domain, record and group pages, the graph and the Model view, Checks, Format and Appearance, quick find, the palette, the shortcuts sheet, a tooltip, the inspector and the phone's sheets, at 1440 px and 375 px, in the Lathe theme and High contrast, each in light and dark.
- **What axe can't see**, walked by keyboard: Tab reaches every control and comes back round with no trap; the main tasks (open a record, switch views, re-center the graph, fold rows, show and hide the inspector, pick a theme) work by keyboard alone; focus stays on the page after a move and returns to the opener when a dialog or a sheet closes; the announcer says what changed.

A finding is fixed by its cause, across the app, and the cause and fix are listed in `notes/a11y-audit.md`. The suite runs on the stability suite's harness (Playwright with Chromium, one worker, a free port), and is run with it for every UI change.
