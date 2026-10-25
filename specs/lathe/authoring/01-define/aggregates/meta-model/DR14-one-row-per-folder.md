---
id: LA-AUT-DR14
kind: domain_rule
title: Each meta-model folder defines a kind at most once
parent: LA-AUT-EN02
---
Within one meta-model folder (Lathe's `meta/` or a product's `metaExtensions` folder), each kind MUST be defined by at most one row of `kinds.csv`. A second row in the same folder MUST be reported as a `meta-duplicate-kind` error that names the file. A row in a later folder for a kind already defined is a widening (`LA-AUT-DR13`), not a duplicate.
