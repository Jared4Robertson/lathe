---
id: LA-MOD-EV02
kind: domain_event
title: Diagram changed
parent: LA-MOD-A1
links:
  raised_by: [LA-MOD-EN01]
---
A file under the diagrams folder was saved, added or removed, which the server announces as `model:changed` so an open diagram page draws it again.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Diagrams folder | The configured diagrams folder that changed. | Folder path. | model |
| File | The file that changed, inside that folder. | File path. | people-and-tools/terms.csv |
| Changed at | When the change was seen. | Date and time. | 2026-10-20T09:20:00Z |
