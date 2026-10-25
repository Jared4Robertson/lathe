---
id: LA-PLT-C36
kind: component
title: Accessibility suite
parent: LA-PLT-LAY07
component_type: test harness
file: app/a11y/axe.ts
links:
  satisfies: [LA-PAT-APP-UX-R10, LA-PLT-UC09-R01]
---
Playwright with Chromium (`app/a11y`), on the stability suite's harness: the Vite dev server on a free port (never 5199) over a copy of the specs, one worker. `audit.spec.ts` runs `@axe-core/playwright` at WCAG 2.2 AA on each page and state, at desktop and phone widths, in four looks (Lathe and High contrast, light and dark), with reduced motion so colors are read at rest; each page in each look is one test. `keyboard.spec.ts` walks the keyboard paths, focus order and announcements. It writes `app/a11y/results/summary.json`, the findings grouped by rule, from which `notes/a11y-audit.md` is written.
