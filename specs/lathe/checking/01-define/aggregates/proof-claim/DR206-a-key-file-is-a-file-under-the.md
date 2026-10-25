---
id: LA-CHK-DR206
kind: domain_rule
title: A key file is a file under the product root
parent: LA-CHK-A5
---
A test's `key_file` MUST name a file under the product root. One outside the root MUST be a `test-file-missing` error; a missing one MUST be a `test-file-missing` error, or a warning for a planned test, and no other check MAY report the test's key or IDs as missing from it.
