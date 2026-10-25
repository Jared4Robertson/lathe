---
id: TL-LEND-A2
kind: aggregate
title: Tool
parent: TL-LEND
links:
  reacts_to: [TL-LEND-EV05, TL-LEND-EV06]
---
One physical item in the catalog. Its condition decides whether it can be lent.

**Business identity:** Tool ID (two drills of the same model are two tools).

| Field | Business meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Tool ID | The library's number for the tool, written on its tag. | Whole number, assigned. | 7 |
| Name | What the tool is. | Text, not blank. | Cordless drill |
| Description | Anything a borrower should know. | Text, may be blank. | 18 V, two batteries |
| Condition | Whether the tool is fit to lend. | `good` or `needs_repair`. | good |
| Damage note | What is wrong, while the tool needs repair. | Text, or none when good. | Chuck wobbles |
| Added at | When the tool joined the catalog. | Date and time. | 2026-03-02T10:00:00Z |
| Status | What a borrower sees in the catalog. | Derived: `on_loan` when it has an active loan, else `needs_repair` when its condition is needs repair, else `available`. | available |
