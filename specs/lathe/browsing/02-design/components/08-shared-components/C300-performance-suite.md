---
id: LA-BRW-C300
kind: component
title: Performance suite
parent: LA-BRW-LAY08
component_type: test harness
file: app/perf/measure.ts
links:
  satisfies: [LA-PAT-APP-UX-R11, LA-BRW-UC117-R11]
---
Playwright with Chromium, one worker (`app/perf`, `npm --prefix app run test:perf`). It builds the app for production into a temporary folder, records each chunk's gzipped size and which ones the first load fetches, and serves the build with `lathe serve`'s server over a copy of the specs on a free port (never 5199). It measures main-thread work from Chromium's own task time (read through the DevTools protocol before and after a step), the longest frame (the longest time between two animation frames, and the long animation frames), and the JavaScript heap after a garbage collection, and holds them to the budgets in `app/perf/budgets.ts`. Above a one-minute load average of 12 it prints the numbers but judges none. It writes `app/perf/results/summary.json`, then runs the engine's script (`LA-CHK-C301`).
