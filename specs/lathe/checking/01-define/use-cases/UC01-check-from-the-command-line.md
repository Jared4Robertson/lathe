---
id: LA-CHK-UC01
kind: use_case
title: Check the workspace from the command line
parent: LA-CHK-CAP01
actor: Agent, Owner
links:
  applies: [LA-CHK-DR01, LA-CHK-DR02, LA-CHK-DR04, LA-AUT-DR01, LA-AUT-DR05, LA-AUT-DR06, LA-AUT-DR07, LA-AUT-DR75]
---
After editing records or code, an agent runs `npm --prefix lathe run check` to find out whether the workspace is broken and what work is left, and fixes errors before handing the work back to the owner.
