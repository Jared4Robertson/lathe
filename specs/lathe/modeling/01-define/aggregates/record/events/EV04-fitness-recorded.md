---
id: LA-MOD-EV04
kind: domain_event
title: Fitness recorded
parent: LA-MOD-A2
links:
  raised_by: [LA-MOD-EN04]
---
The owner wrote a `fitness` record, their own judgment of how well the product serves them, which becomes the product's latest fitness.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Product | Whose fitness it is. | Product reference. | LA |
| Experiences | The experiences behind the score, in the owner's words. | Text. | Reviewing problems while an agent edits is smooth |
| Date | The day of the judgment. | Date. | 2026-10-24 |
| Score | How well the product serves the owner. | Whole number from 1 to 5. | 3 |
