---
id: LA-MOD-EV01
kind: domain_event
title: Diagram created
parent: LA-MOD-A1
links:
  raised_by: [LA-MOD-EN01]
---
The owner created a new, empty diagram from the app's form, registered by a new row in `model/diagrams.csv`.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Slug | The diagram's folder name under `model/`, and its address. | Text, lower case with dashes. | people-and-tools |
| Title | What the diagram is called. | Text, not blank. | People and tools |
| Description | What the diagram is for. | Text, optional. | The foundation: people, tools, and how actions and occurrences affect them. |
| Created at | When the diagram was created. | Date and time. | 2026-10-20T09:15:00Z |
