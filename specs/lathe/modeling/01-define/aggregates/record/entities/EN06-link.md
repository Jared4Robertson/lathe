---
id: LA-MOD-EN06
kind: entity
title: Link
parent: LA-MOD-A2
role: child
links:
  refers_to: [LA-MOD-EN04, LA-CHK-EN03]
---
One outgoing link in a record's `links` map: a relation name and the record it points to.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Relation | What the link says about its target. | Relation reference, allowed by the meta-model for the two kinds. | proves |
| Target | The record the link points to. | Record reference. | TL-LEND-DR05 |
