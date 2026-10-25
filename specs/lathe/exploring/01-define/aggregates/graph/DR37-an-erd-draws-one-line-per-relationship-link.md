---
id: LA-EXP-DR37
kind: domain_rule
title: An ERD draws exactly one line per relationship link
parent: LA-EXP-EN08
---
An aggregate's ERD MUST draw exactly one line for each `has_one`, `has_many` and `refers_to` link its entities hold, so each such link of a domain appears in exactly one aggregate's ERD. A domain's ERD MUST draw exactly one line for each aggregate pair and direction that a `refers_to` link between their entities joins, and no line that no link stands for.
