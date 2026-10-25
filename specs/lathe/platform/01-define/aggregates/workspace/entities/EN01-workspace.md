---
id: LA-PLT-EN01
kind: entity
title: Workspace
parent: LA-PLT-A1
role: root
---
The result of one load of a repo's specs: what the engine read, from where, and what it found.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Specs folder | Where the records were read from. | Folder path, relative to the root. | specs |
| Diagrams folder | Where the diagrams were read from. | Folder path, relative to the root. | model |
| Checks folder | Where the product's own checks were read from. | Folder path, or none. | lathe-checks |
| Extensions folder | Where the product's meta-model extension was read from. | Folder path, or none. | None |
| ID prefixes | Prefixes besides product and domain IDs that a body may cite. | List of prefixes, or none. | None |
| Errors | How many problems are errors. | Derived count. | 0 |
