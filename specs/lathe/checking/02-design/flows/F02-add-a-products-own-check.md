---
id: LA-CHK-F02
kind: flow
title: Add a product's own check
parent: LA-CHK
links:
  carries_out: [LA-CHK-UC05]
---
1. The owner decides a rule belongs to their product, not to Lathe, such as "every endpoint has at least one interaction requirement".
2. They name a checks folder in `lathe.config.json`, `"checks": "lathe-checks"`, and writes the rule there as `01-endpoint-without-interaction-requirement.sql`: one `SELECT` over the loaded tables returning `(severity, check, record, message)`.
3. They run `lathe check`. Lathe's checks run first, then the product's; each of its problems is reported under `endpoint-without-interaction-requirement`, with the others.
4. Had they named the file after one of Lathe's checks, or written SQL that fails, `lathe check` reports an error naming the file instead.
5. They fix what the new check finds, here by writing each endpoint's interaction requirements, and rerun `lathe check` until it is clean.
