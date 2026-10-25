---
id: LA-AUT-UC09-R01
kind: requirement
title: The engine loads the folders and each kind's folder
parent: LA-AUT-UC09
---
The engine MUST load each kind's `section` into `kinds`, and the rows of `sections.csv` into a `sections` table and `Workspace.sections`, with product-level folders (no stage) first, then each stage's folders in their `order`. A meta-model folder without `sections.csv` MUST give no folders, and a kind with no `section` sits in none.
