---
id: LA-CHK-DF01-S02
kind: design_step
title: The loader finds and parses every record file
parent: LA-CHK-DF01
order: 2
links:
  uses: [LA-PLT-C01]
  satisfies: [LA-CHK-UC01-R05]
---
Every `*.md` file under the specs folder but a README is read and its header parsed. A file that cannot be parsed becomes a `parse-error` problem, and the rest still load.
