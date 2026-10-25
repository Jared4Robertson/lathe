---
id: LA-CHK-C180
kind: component
title: Reference model and Markdown
parent: LA-CHK-LAY12
component_type: module
file: lathe/src/reference.ts
links:
  satisfies: [LA-CHK-UC25-R01, LA-CHK-UC25-R02, LA-CHK-DR194]
---
The `FormatReference` shape (kinds, relations, folders and checks, with the concepts) and `renderReference`, which writes it as one Markdown document: the concepts, then each kind, relation, folder and check under its own anchor (`kind-use_case`, `relation-proves`, `folder-test-plan`, `check-unproved`), with links between them. It also documents the engine's own problems as checks.
