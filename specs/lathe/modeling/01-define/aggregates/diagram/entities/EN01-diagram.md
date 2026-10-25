---
id: LA-MOD-EN01
kind: entity
title: Diagram
parent: LA-MOD-A1
role: root
links:
  has_many: [LA-MOD-EN02, LA-MOD-EN03]
---
A named canvas of terms and the links between them, registered by one row in `model/diagrams.csv`.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Slug | The diagram's folder under `model/` and its address. | Text: lower-case words joined by hyphens, unique. | people-and-tools |
| Title | What the diagram is called. | Text, not blank. | People and tools |
| Description | What the diagram is about. | Text, optional. | The foundation: people and tools |
