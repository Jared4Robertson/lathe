---
id: LA-AUT-C47
kind: component
title: Reference model and Markdown
parent: LA-AUT-LAY08
component_type: module
file: lathe/src/reference.ts
links:
  satisfies: [LA-AUT-UC12-R01, LA-AUT-UC12-R02, LA-AUT-UC12-R07, LA-AUT-DR59]
---
The `FormatReference` shape (kinds, relations, folders and checks, with the concepts) and `renderReference`, which writes it as one Markdown document: the concepts, then each kind, relation, folder and check under its own anchor (`kind-use_case`, `relation-proves`, `folder-test-plan`, `check-unproved`), with links between them. It also documents the engine's own problems as checks.
