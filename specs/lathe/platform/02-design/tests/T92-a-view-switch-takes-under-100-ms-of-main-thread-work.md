---
id: LA-PLT-T92
kind: test
title: "Performance: a view switch takes under 100 ms of main-thread work"
parent: LA-PLT
test_type: acceptance
run_by: app/perf/app.perf.ts
links:
  proves: [LA-PLT-UC09-R11, LA-PAT-APP-UX-R11]
---
On a record page, opens and closes the Graph pane (after a first open has loaded its code) and expects each switch to take under 100 ms of main-thread work.
