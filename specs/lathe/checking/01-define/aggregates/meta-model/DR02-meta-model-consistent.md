---
id: LA-CHK-DR02
kind: domain_rule
title: The meta-model refers only to kinds it defines
parent: LA-CHK-A1
---
Each kind name MUST be unique within one meta-model folder (a product's extension may widen a default kind by repeating its name), and each relation rule (relation, source kind, target kind) MUST be listed once. Every kind named in `parent_kinds`, and every `source_kind` and `target_kind` in a relation rule (other than `*`), MUST be a kind listed in `kinds.csv`. Every name in a kind's `required_fields` MUST be a valid field name: lower-case letters, digits and underscores, starting with a letter, and not one of the fields every record has (`id`, `kind`, `title`, `parent`, `links`).

A breach of this rule MUST be reported as an error with no record, from a check named `meta-...`.
