---
id: LA-PLT-T95
kind: test
title: "Performance: memory after 50 navigations"
parent: LA-PLT
test_type: acceptance
run_by: app/perf/app.perf.ts
links:
  proves: [LA-PAT-APP-UX-R11]
---
With the wiki and the graph open, moves through 50 records and measures the JavaScript heap after a garbage collection, before and after, without a budget, so a leak shows in the report.
