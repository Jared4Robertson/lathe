---
id: LA-CHK-DR02
kind: domain_rule
title: The meta-model refers only to kinds it defines
parent: LA-CHK-A1
---
Each kind name MUST be unique. Every kind named in `parent_kinds`, and every `source_kind` and `target_kind` in a relation rule (other than `*`), MUST be a kind listed in `kinds.csv`.
