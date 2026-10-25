---
id: LA-CHK-T600
kind: test
title: Loading Lathe's spec takes under 2 s and a live reload under 500 ms
parent: LA-CHK
test_type: acceptance
run_by: lathe/perf/engine.ts
links:
  proves: [LA-CHK-UC04-R03, LA-CHK-DR310]
---
`npm --prefix lathe run test:perf`. Loads a copy of Lathe's spec cold, then changes one record file and reloads, and expects the median cold load under 2 s and the median reload under 500 ms; measures a synthetic product of about 10,000 records and the format reference without a budget. On a busy machine (a one-minute load average above 12) it judges nothing and exits 3.
