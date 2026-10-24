---
id: LA-CHK-DR04
kind: domain_rule
title: The workspace is rebuilt from the files on every load
parent: LA-CHK-A2
---
Each load MUST read the files afresh and build a new in-memory DuckDB. The engine MUST NOT write a database file or keep state between loads, so the files stay the only source of truth.
