---
id: LA-CHK-UC01
kind: use_case
title: Check the workspace from the command line
parent: LA-CHK
actor: AI agent, Jared
links:
  applies: [LA-CHK-DR05, LA-CHK-DR06, LA-CHK-DR09, LA-MOD-DR06, LA-MOD-DR10, LA-MOD-DR11, LA-MOD-DR12]
---
After editing records or code, an AI agent runs `npm --prefix lathe run check` to find out whether the workspace is broken and what work is left, and fixes errors before handing the work back to Jared.
