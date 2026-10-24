---
id: LA-CHK-UC15-R01
kind: requirement
title: "The checks folder in the config runs after Lathe's checks"
parent: LA-CHK-UC15
---
When the product's `lathe.config.json` names a `checks` folder, the engine MUST run every `*.sql` file in it after all of Lathe's checks, in file name order, against the same tables, and MUST read the same `(severity, check, record, message)` rows from each. When the config names no `checks` folder, only Lathe's checks MUST run.
