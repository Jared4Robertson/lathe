---
id: LA-CHK-EN20
kind: entity
title: Child count
parent: LA-CHK-A10
role: child
links:
  refers_to: [LA-MOD-EN04]
---
How many children of one kind one record holds, judged against the limit.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Parent | The record whose children are counted. | Record reference. | TL-LEND-A2 |
| Kind | The kind of children counted; tests are never counted. | Kind reference. | domain_rule |
| Count | How many it holds. | Derived count. | 4 |
| Too many | Whether the count is over the limit. | Derived yes or no. | No |
| Lone child | Whether a capability or layer holds exactly one child. | Derived yes or no. | No |
