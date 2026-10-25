---
id: TL-LEND-EV03
kind: domain_event
title: Damage reported
parent: TL-LEND-A2
links:
  raised_by: [TL-LEND-EN03]
---
A librarian marked a tool as needing repair outside a return, which takes it out of lending and leaves any loan on it open.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Tool ID | Which tool is damaged. | Tool reference. | Tool 7 |
| Note | What is wrong with the tool. | Text, not blank. | Chuck wobbles |
| Reported at | When the damage was reported. | Date and time. | 2026-03-10T14:05:00Z |
