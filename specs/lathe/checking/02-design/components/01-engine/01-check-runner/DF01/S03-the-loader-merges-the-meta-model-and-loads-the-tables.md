---
id: LA-CHK-DF01-S03
kind: design_step
title: The loader merges the meta-model and loads the records into DuckDB
parent: LA-CHK-DF01
order: 3
statements: one CREATE TABLE per table, then its rows
links:
  uses: [LA-AUT-C06]
---
Lathe's `kinds.csv`, `relations.csv`, `sections.csv` and `ids.csv` are merged with the product's extensions, and the records, fields, links and file facts are loaded into tables of an in-memory database.
