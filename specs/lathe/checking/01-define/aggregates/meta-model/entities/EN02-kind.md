---
id: LA-CHK-EN02
kind: entity
title: Kind
parent: LA-CHK-A1
role: child
links:
  refers_to: [LA-CHK-EN04]
---
One kind of record, one row of the kinds file: where it sits, what it needs and whether it is an obligation.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Kind | The kind's name, as a record's `kind` gives it. | Text, unique. | test |
| Label | The kind's name as people read it. | Text. | Test |
| Stage | The stage the kind belongs to. | `define`, `design`, or none for a structural kind. | design |
| Section | The folder the kind sits in. | Section reference, or none. | test-plan |
| Parent kinds | The kinds a record of this kind may sit under. | List of kinds. | domain capability |
| Required fields | The header fields a record of this kind must give. | List of field names. | test_type |
| Obligation | Whether a record of this kind must be designed, built and proved. | `yes`, `proof` (proof only) or anything else for no. | no |
| Description | What the kind is for. | Text. | A test that proves obligations. |
