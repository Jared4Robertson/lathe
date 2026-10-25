---
id: LA-TRC-UC08-R03
kind: requirement
title: A manual test whose file never mentions it is reported
parent: LA-TRC-UC08
---
A manual test whose `run_by` file exists but names neither the test's ID, nor any ID it proves, nor its `key` MUST get a `manual-test-file-silent` warning naming the test and the file. Automated and planned tests MUST NOT get this warning.
