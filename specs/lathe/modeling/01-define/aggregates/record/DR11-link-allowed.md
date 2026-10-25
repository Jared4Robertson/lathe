---
id: LA-MOD-DR11
kind: domain_rule
title: A link uses a relation allowed for its source and target kinds
parent: LA-MOD-A2
---
Each relation in a record's `links` MUST appear in `lathe/meta/relations.csv` with this record's kind as `source_kind` and the target's kind as `target_kind`, or with `*` as `target_kind`.
