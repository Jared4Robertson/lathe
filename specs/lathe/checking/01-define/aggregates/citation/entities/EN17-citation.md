---
id: LA-CHK-EN17
kind: entity
title: Citation
parent: LA-CHK-A8
role: root
links:
  refers_to: [LA-MOD-EN04]
---
One ID cited in a record's prose, which becomes one of the record's mentions when the cited record exists.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Citing record | The record whose body cites the ID. | Record reference. | TL-LEND-UC05-R03 |
| Cited ID | The whole ID-shaped token cited. | Text in the ID format. | TL-LEND-DR11 |
| Known prefix | The product, domain or configured prefix the ID starts with. | Text. | TL-LEND |
| Place | Its place among the record's mentions, by first mention. | Derived whole number. | 1 |
| Exists | Whether a record has the ID; if not, it is reported. | Derived yes or no. | Yes |
