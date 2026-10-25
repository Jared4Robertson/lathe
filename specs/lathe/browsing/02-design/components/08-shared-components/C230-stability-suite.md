---
id: LA-BRW-C230
kind: component
title: Stability suite
parent: LA-BRW-LAY08
component_type: test harness
file: app/stability/measure.ts
links:
  satisfies: [LA-PAT-APP-CODE-R17]
---
Playwright with Chromium only (`app/stability`). It starts the Vite dev server on a free port (never 5199) over a copy of the specs, and runs scripted scenarios with one worker. In each step it records every layout shift (a `PerformanceObserver` for `layout-shift`, with the shifts just after input flagged), long animation frames, and the boxes of key elements frame by frame, and fails a step whose unexpected shift passes 0.01 or whose key elements move, jump back or remount. Shifts that only move the nav or the tab strip are reported as deferred until phase 2 of brief 53. It writes `app/stability/results/summary.json`.
