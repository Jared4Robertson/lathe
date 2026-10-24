---
id: LA-CHK-UC14-R06
kind: requirement
title: A relation rule listed twice in one folder is an error naming the folder
parent: LA-CHK-UC14
---
Two rows for the same relation rule in one folder's `relations.csv` MUST be reported as a `meta-duplicate-relation` error with no record, whose message names that file and the rule.
