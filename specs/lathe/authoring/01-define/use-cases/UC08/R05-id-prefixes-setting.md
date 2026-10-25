---
id: LA-AUT-UC08-R05
kind: requirement
title: The config may list extra ID prefixes
parent: LA-AUT-UC08
---
The engine MUST accept an optional `idPrefixes` list in `lathe.config.json` and add its entries to the known prefixes, and MUST refuse to load when the value is not a list of ID prefixes.
