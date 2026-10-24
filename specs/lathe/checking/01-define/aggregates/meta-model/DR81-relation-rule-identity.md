---
id: LA-CHK-DR81
kind: domain_rule
title: A relation rule is its relation, source kind and target kind
parent: LA-CHK-A1
---
A relation rule MUST be identified by its `relation`, `source_kind` and `target_kind` alone; its `role` and `description` describe it. The loaded meta-model MUST hold each rule once. Within one folder each rule MUST be listed at most once; a row in a later folder for the same rule restates it (`LA-CHK-DR31`).
