---
id: LA-TRC-UC02-R06
kind: requirement
title: The obligation and role columns are loaded
parent: LA-TRC-UC02
---
Loading MUST read `obligation` (yes or no) from `kinds.csv` and `role` from `relations.csv` into the `kinds` and `relations` tables and the returned workspace. A meta-model folder without these columns MUST still load, with no obligations and no roles from it.
