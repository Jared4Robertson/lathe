---
id: LA-AUT-DR31
kind: domain_rule
title: Configured ID prefixes are ID-shaped
parent: LA-AUT-EN02
---
Each entry of `idPrefixes` MUST match the ID format of FORMAT.md section 2. A value that is not a list of such entries MUST stop the load with a message naming `idPrefixes`, as an invalid `lathe.config.json` does.
