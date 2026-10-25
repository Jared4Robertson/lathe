---
id: LA-AUT-EN22
kind: entity
title: Test
parent: LA-AUT-A10
role: root
---
One test of a domain.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the test's number. | Text in the ID format. | TL-LEND-T05 |
| Type and state | What sort of test it is, and whether it is automated, manual or planned. | Text, and `automated`, `manual` or `planned`. | acceptance, automated |
| Run by | The file that runs an automated test. | File path under the product root. | test/loans.test.ts |
| Proves and supports | What it is proof of, and what it backs without proving. | Lists of obligation references. | TL-LEND-DR05 |
