---
id: LA-AUT-UC04-R04
kind: requirement
title: Two rows for one kind in one folder are an error naming the folder
parent: LA-AUT-UC04
---
Two rows for the same kind in one folder's `kinds.csv` MUST be reported as a `meta-duplicate-kind` error with no record, whose message names that file and the kind.
