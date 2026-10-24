---
id: LA-CHK-F15
kind: flow
title: Add a product's own check
parent: LA-CHK-CAP04
links:
  carries_out: [LA-CHK-UC15]
---
1. Jared decides a rule belongs to his product, not to Lathe, such as "every endpoint has at least one interaction requirement".
2. He names a checks folder in `lathe.config.json`, `"checks": "lathe-checks"`, and writes the rule there as `01-endpoint-without-interaction-requirement.sql`: one `SELECT` over the loaded tables returning `(severity, check, record, message)`.
3. He runs `lathe check`. Lathe's checks run first, then his; each of his problems is reported under `endpoint-without-interaction-requirement`, with the others.
4. Had he named the file after one of Lathe's checks, or written SQL that fails, `lathe check` reports an error naming the file instead.
5. He fixes what the new check finds, here by writing each endpoint's interaction requirements, and reruns `lathe check` until it is clean.
