---
id: LA-CHK-EN13
kind: entity
title: Pattern following
parent: LA-CHK-A6
role: root
links:
  has_many: [LA-CHK-EN14, LA-CHK-EN15]
  refers_to: [LA-MOD-EN04]
---
A domain or use case that follows one pattern.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Follower | The domain or use case that follows the pattern. | Record reference. | TL-LEND-UC01 |
| Pattern | The pattern followed. | Record reference. | TL-PAT-LIBRARIAN-ACTION |
| Domain | The domain that owes the pattern's rules because of it. | Derived record reference. | TL-LEND |
