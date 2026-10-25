---
id: LA-TRC-F02
kind: flow
title: See proof still owed and tests by state
parent: LA-TRC
links:
  fulfills: [LA-TRC-UC06-R01, LA-TRC-UC06-R02, LA-TRC-UC06-R03]
  carries_out: [LA-TRC-UC06]
---
1. The owner runs `lathe check` on a product where some proved obligations still have planned tests.
2. Each obligation line where proof is still owed beyond what is unproved ends with how many have a planned test, such as `; 3/4 with a planned test`.
3. After each domain's obligation lines they read its tests by state, such as `LA-CHK tests: 99 automated, 0 manual, 0 planned`.
4. An agent reads the same counts from `lathe check --json`: `planned_any` on each obligation and `tests` on each domain's coverage.
