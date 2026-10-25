---
id: LA-PLT-DR01
kind: domain_rule
title: The workspace is rebuilt from the files on every load
parent: LA-PLT-A1
---
Each load MUST read the files afresh and build a new in-memory DuckDB. The engine MUST NOT write a database file or keep state between loads, so the files stay the only source of truth. It MAY keep a record file's parse with the exact text it was parsed from, and use it when a later load reads the same text, since the same text always gives the same parse (`LA-PLT-DR02`); and the format reference while none of the files it reads has changed.
