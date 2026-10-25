---
id: LA-CHK-EN21
kind: entity
title: Format reference
parent: LA-CHK-A12
role: root
links:
  refers_to: [LA-CHK-EN02, LA-CHK-EN03, LA-CHK-EN04, LA-CHK-EN08]
---
One product's reference, built on each load from its meta-model and its check files.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Product | The product repo the reference is for. | Folder. | the Lathe repo |
| Concepts | The record format's ideas, from FORMAT.md. | Markdown. | # Lathe spec format |
| Kinds | Every kind after the extensions, with its ID convention and its children. | Kind references. | use_case |
| Relations | Every relation rule. | Relation rule references. | proves from test to requirement |
| Folders | Every folder, in stage then order. | Section references. | test-plan |
| Checks | Lathe's checks, the engine's own, then the product's, each with its header's text. | Check references. | unproved |
