---
id: LA-BRW-EN04
kind: entity
title: Folder
parent: LA-BRW-A3
role: root
links:
  has_many: [LA-BRW-EN05]
  refers_to: [LA-CHK-EN04, LA-MOD-EN04]
---
One named, ordered group of records by kind in a domain, as the navigation and the pages show it.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Section | The folder of the meta-model it shows. | Section reference. | test-plan |
| Domain | The domain whose records it holds. | Record reference. | TL-LEND |
| Label | The name shown. | Derived from the section. | Test plan |
| Folded | Whether it is folded in the navigation, for this browser session. | Yes or no. | No |
