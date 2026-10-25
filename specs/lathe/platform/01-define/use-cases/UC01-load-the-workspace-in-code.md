---
id: LA-PLT-UC01
kind: use_case
title: Load the workspace in code
parent: LA-PLT-CAP03
actor: Agent
links:
  applies: [LA-PLT-DR01, LA-AUT-DR03, LA-PLT-DR02]
---
Code such as the web app's spec API, or an agent's script, calls `loadWorkspace(root)` to get every record, link, problem and coverage figure for the repo at `root`.
