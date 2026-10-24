---
id: LA-CHK-UC01-R02
kind: requirement
title: The check exits non-zero on any error
parent: LA-CHK-UC01
---
`lathe check` MUST exit with status 1 when there is at least one error, and with status 0 otherwise. Warnings MUST NOT change the exit status.
