---
id: LA-CHK-UC03-R04
kind: requirement
title: A cited ID that is not a record is a warning
parent: LA-CHK-UC03
---
For each record and each distinct cited ID that no record has, the engine MUST report one `unknown-id-in-prose` warning on the citing record, worded as "<record> mentions <ID>, which does not exist."
