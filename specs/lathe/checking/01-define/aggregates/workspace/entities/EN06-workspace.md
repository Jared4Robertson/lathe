---
id: LA-CHK-EN06
kind: entity
title: Workspace
parent: LA-CHK-A2
role: root
links:
  has_many: [LA-CHK-EN07]
  refers_to: [LA-CHK-EN01]
---
The result of one load of a repo's specs: what the engine read, from where, and what it found.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Specs folder | Where the records were read from. | Folder path, relative to the root. | specs |
| Checks folder | Where the product's own checks were read from. | Folder path, or none. | lathe-checks |
| Extensions folder | Where the product's meta-model extension was read from. | Folder path, or none. | None |
| ID prefixes | Prefixes besides product and domain IDs that a body may cite. | List of prefixes, or none. | None |
| Errors | How many problems are errors. | Derived count. | 0 |
