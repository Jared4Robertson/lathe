---
id: LA-MOD-DR09
kind: domain_rule
title: A record has every field its kind requires
parent: LA-MOD-A2
---
A record MUST have a non-empty title, a kind listed in `lathe/meta/kinds.csv`, and a non-empty value for each of that kind's `required_fields` (for example `actor` on a use case, `file` on a component).
