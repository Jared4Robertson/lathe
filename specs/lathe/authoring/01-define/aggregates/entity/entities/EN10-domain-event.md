---
id: LA-AUT-EN10
kind: entity
title: Domain event
parent: LA-AUT-A3
role: child
links:
  refers_to: [LA-AUT-EN08]
---
An unchangeable record that something happened, raised by its aggregate and named in the past tense.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the event's number. | Text in the ID format. | TL-LEND-EV01 |
| Title | What happened, in the past tense. | Text. | Loan opened |
| Raised by | The entity of its aggregate whose change raises it, if any. | Entity reference, or none. | TL-LEND-EN02 |
| Reacted to by | The aggregates, use cases and components that react to it. | Derived list of record references. | TL-LEND-A3 |
