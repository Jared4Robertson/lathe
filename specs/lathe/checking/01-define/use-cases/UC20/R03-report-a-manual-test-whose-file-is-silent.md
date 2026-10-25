---
id: LA-CHK-UC20-R03
kind: requirement
title: A manual test whose file never mentions it is reported
parent: LA-CHK-UC20
---
A manual test whose `run_by` file exists but names neither the test's ID, nor any ID it proves, nor its `key` MUST get a `manual-test-file-silent` warning naming the test and the file. Automated and planned tests MUST NOT get this warning.
