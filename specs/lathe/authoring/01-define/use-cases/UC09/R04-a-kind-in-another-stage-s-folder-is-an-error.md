---
id: LA-AUT-UC09-R04
kind: requirement
title: A kind in another stage's folder is an error
parent: LA-AUT-UC09
---
A kind whose folder belongs to a stage other than the kind's own MUST be a `section-stage-mismatch` error naming the kind, its stage and the folder's stage. A folder of no stage, such as `shared`, MUST NOT be reported for any kind.
