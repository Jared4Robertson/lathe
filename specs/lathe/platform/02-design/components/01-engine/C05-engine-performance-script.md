---
id: LA-PLT-C05
kind: component
title: Engine performance script
parent: LA-PLT-LAY01
component_type: test harness
file: lathe/perf/engine.ts
links:
  satisfies: [LA-PLT-DR02]
---
`npm --prefix lathe run test:perf`: loads a copy of this repo's specs (the code folders linked, so tests' files resolve) cold three times, then changes one record file and reloads five times, and holds the median cold load to 2 s and the median reload to 500 ms. It also measures the format reference, and a synthetic product of about 10,000 records (Lathe's spec copied six times under the prefixes LB to LG), without a budget. It prints each phase's time; above a one-minute load average of 12 (`PERF_MAX_LOAD`) it judges nothing and exits 3.
