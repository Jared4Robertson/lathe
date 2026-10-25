---
id: LA-TRC-EN05
kind: entity
title: Pattern following
parent: LA-TRC-A3
role: root
links:
  has_many: [LA-TRC-EN06, LA-TRC-EN07]
---
A domain or use case that follows one pattern.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Follower | The domain or use case that follows the pattern. | Record reference. | TL-LEND-UC01 |
| Pattern | The pattern followed. | Record reference. | TL-PAT-LIBRARIAN-ACTION |
| Domain | The domain that owes the pattern's rules because of it. | Derived record reference. | TL-LEND |
