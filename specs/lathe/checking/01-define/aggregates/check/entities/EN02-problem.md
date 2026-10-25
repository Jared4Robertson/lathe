---
id: LA-CHK-EN02
kind: entity
title: Problem
parent: LA-CHK-A1
role: child
links:
  refers_to: [LA-PLT-EN01]
---
One thing a check found wrong or still to do in the loaded workspace.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Severity | Whether the workspace is broken or has work still to do. | `error` or `warning`. | warning |
| Check | The check that found it. | Check reference, by name. | unproved |
| Record | The record it is about. | Record reference, or none for the whole workspace. | TL-LEND-E06-R03 |
| Message | What is wrong, and the fix. | Text. | No test proves interaction requirement TL-LEND-E06-R03 yet: its test is only planned. |
