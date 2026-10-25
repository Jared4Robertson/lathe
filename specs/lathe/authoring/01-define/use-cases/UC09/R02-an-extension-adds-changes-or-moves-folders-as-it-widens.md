---
id: LA-AUT-UC09-R02
kind: requirement
title: An extension adds, changes or moves folders as it widens kinds
parent: LA-AUT-UC09
---
A product's `sections.csv` row for a new folder MUST add it, and a row for a listed folder MUST replace its stage, order, label or description with any that is non-empty. A kind row with a non-empty `section` MUST move the kind into that folder; an empty one MUST keep the default's.
