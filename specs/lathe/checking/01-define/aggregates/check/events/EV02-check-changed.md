---
id: LA-CHK-EV02
kind: domain_event
title: Check changed
parent: LA-CHK-A3
links:
  raised_by: [LA-CHK-EN08]
---
A check's SQL file was added, edited or removed, among Lathe's checks or a product's own, which the server announces as `spec:changed`.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| File | The check file that changed. | File path. | lathe/checks/01-duplicate-id.sql |
| Change | What happened to the file. | `added`, `changed` or `removed`. | changed |
| Changed at | When the change was seen. | Date and time. | 2026-10-24T14:10:00Z |
