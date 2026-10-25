---
id: LA-AUT-DR28
kind: domain_rule
title: Every product's and domain's ID, and each configured prefix, is a known ID prefix
parent: LA-AUT-EN02
---
The known ID prefixes MUST be every product ID, every domain ID and each entry of `idPrefixes` in `lathe.config.json`. A token that is not a record MUST be a citation only when it starts with a known prefix followed by a hyphen.
