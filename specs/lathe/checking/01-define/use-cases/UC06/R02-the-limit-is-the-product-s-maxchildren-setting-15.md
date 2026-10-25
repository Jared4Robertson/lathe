---
id: LA-CHK-UC06-R02
kind: requirement
title: The limit is the product's maxChildren setting, 15 by default
parent: LA-CHK-UC06
---
The engine MUST read `structure.maxChildren` from `lathe.config.json` through the config loader, use 15 when it is absent, refuse any value that is not a whole number of at least 1, and give it to the checks as a row of the `settings` table.
