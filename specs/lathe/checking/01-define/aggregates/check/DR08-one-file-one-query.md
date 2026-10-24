---
id: LA-CHK-DR08
kind: domain_rule
title: A check is one SQL file with one query
parent: LA-CHK-A3
---
Each check MUST be a single `SELECT severity, check, record, message ...` query in its own file in `lathe/checks/`. Its name MUST be the file name without the number prefix and `.sql`.
