---
id: LA-CHK-DR31
kind: domain_rule
title: An extension widens a default kind and never narrows it
parent: LA-CHK-A1
---
A product's extension row for a kind Lathe already defines MUST add its `parent_kinds` and `required_fields` to the default's and MUST NOT remove any. A non-empty `label`, `stage`, `obligation` or `description` in the extension MUST replace the default's; an empty one MUST leave the default's in place. The result is one kind, so every check and every count sees one row for it.
