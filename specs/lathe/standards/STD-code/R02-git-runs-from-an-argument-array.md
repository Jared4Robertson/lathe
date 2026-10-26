---
id: LA-STD-CODE-R02
kind: standard_rule
title: Git runs from an argument array
parent: LA-STD-CODE
---
The code MUST run `git` with `spawn` and an array of arguments, with `shell: false`, and MUST NOT build a command string for a shell, so no record ID or path can be read as shell syntax.
