---
id: LA-CHK-UC09
kind: use_case
title: Adapt one of Lathe's default kinds in a product
parent: LA-CHK
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR31, LA-CHK-DR32]
---
A product's specs do not quite fit a default kind, for example its domain rules sit directly under a domain rather than under an aggregate. Without forking Lathe, the person adds a row for that kind to the product's `metaExtensions` `kinds.csv` with only what changes, such as `domain` in `parent_kinds`. The next `lathe check` accepts the product's records, and every other default stays as it was.
