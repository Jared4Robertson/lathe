---
id: LA-CHK-EV01
kind: domain_event
title: Meta-model changed
parent: LA-CHK-A1
links:
  raised_by: [LA-CHK-EN01]
---
A kinds, relations, sections or IDs file of the meta-model, or a product's extension of it, was edited, which the server announces as `spec:changed`.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| File | The meta-model file that changed. | File path. | lathe/meta/relations.csv |
| Product | The product whose extension changed, or none for Lathe's defaults. | Product reference, or none. | none |
| Changed at | When the change was seen. | Date and time. | 2026-10-24T23:24:05Z |
