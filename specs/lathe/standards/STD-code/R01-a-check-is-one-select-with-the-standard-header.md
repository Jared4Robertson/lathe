---
id: LA-STD-CODE-R01
kind: standard_rule
title: A check is one SELECT with the standard header
parent: LA-STD-CODE
---
Each check MUST be one SQL file in `lathe/checks/` (or a product's own checks folder) holding a single `SELECT` that returns `severity`, `check`, `record` and `message`. It MUST start with the standard header comment: one summary sentence, a blank comment line, the explanation ending with how to fix what it reports, a blank comment line, then the `severity:` line and an optional `kinds:` line.
