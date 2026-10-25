---
id: LA-AUT-DR11
kind: domain_rule
title: The meta-model changes only by editing its files
parent: LA-AUT-EN02
---
The meta-model MUST change only by editing `lathe/meta/kinds.csv` and `lathe/meta/relations.csv` (or a product's `metaExtensions` files) and reviewing the diff in git, as records are. The web app and its API MUST NOT write the meta-model files, and MUST NOT offer a way to change them.
