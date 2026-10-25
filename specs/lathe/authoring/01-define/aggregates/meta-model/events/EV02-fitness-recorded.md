---
id: LA-AUT-EV02
kind: domain_event
title: Fitness recorded
parent: LA-AUT-A1
links:
  raised_by: [LA-AUT-EN01]
---
The owner wrote a `fitness` record, their own judgment of how well the product serves them, which becomes the product's latest fitness.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Product | Whose fitness it is. | Product reference. | LA |
| Experiences | The experiences behind the score, in the owner's words. | Text. | Reviewing problems while an agent edits is smooth |
| Date | The day of the judgment. | Date. | 2026-10-24 |
| Score | How well the product serves the owner. | Whole number from 1 to 5. | 3 |
