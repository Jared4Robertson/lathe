---
id: LA-PLT-DR02
kind: domain_rule
title: A load stays within the engine's performance budgets
parent: LA-PLT-A1
---
Loading Lathe's own spec (about 1,800 records, every file parsed) MUST take under 2 s, and a live reload after one record file changes under 500 ms, on the dev machine, as `npm --prefix lathe run test:perf` measures (`lathe/perf/engine.ts`, which also measures a synthetic product of about 10,000 records without a budget). A reload parses only the files whose text changed, and the checks and the coverage queries run side by side on a few connections to the same database; every check still runs on every load, because a check reads across kinds (a link's target, a parent chain, coverage), so a change to one record can change the problems of records of other kinds. The format reference is kept while the meta-model, the check files, `FORMAT.md` and the config are unchanged. When the machine is busy (a one-minute load average above 12) the script measures but judges nothing; a budget is never loosened to make a busy run pass.
