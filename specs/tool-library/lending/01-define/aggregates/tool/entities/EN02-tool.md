---
id: TL-LEND-EN02
kind: entity
title: Tool
parent: TL-LEND-A2
role: root
links:
  has_one: [TL-LEND-EN03]
---
One physical item in the catalog, known by the number on its tag.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Tool ID | The library's number for the tool, written on its tag. | Whole number, assigned. | 7 |
| Name | What the tool is. | Text, not blank. | Cordless drill |
| Description | Anything a borrower should know. | Text, may be blank. | 18 V, two batteries |
| Condition | Whether the tool is fit to lend. A new tool starts good. | `good` or `needs_repair`. | needs_repair |
| Added at | When the tool joined the catalog. | Date and time. | 2026-02-20T09:00:00Z |
| Status | What a borrower sees in the catalog. | Derived: `on_loan` while it has an active loan, else `needs_repair` when its condition is needs repair, else `available`. | needs_repair |
