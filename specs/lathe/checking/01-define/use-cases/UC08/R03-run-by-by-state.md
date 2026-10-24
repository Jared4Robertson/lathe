---
id: LA-CHK-UC08-R03
kind: requirement
title: Only an automated test needs a run_by
parent: LA-CHK-UC08
---
An automated test with no `run_by` MUST be reported as a `test-run-by-missing` error. A manual or planned test MUST NOT need a `run_by`; if it names one, the file MUST exist (`test-file-missing`), but it MUST NOT need to mention any ID.
