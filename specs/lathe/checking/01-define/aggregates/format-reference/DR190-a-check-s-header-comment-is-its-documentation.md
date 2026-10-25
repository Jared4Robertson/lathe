---
id: LA-CHK-DR190
kind: domain_rule
title: A check's header comment is its documentation
parent: LA-CHK-A12
---
Every check file MUST start with a header comment of one summary sentence, a blank comment line, the explanation ending with how to fix what it reports, a blank comment line, then a `severity:` line and an optional `kinds:` line. The reference MUST take each check's text from this header and from nowhere else.
