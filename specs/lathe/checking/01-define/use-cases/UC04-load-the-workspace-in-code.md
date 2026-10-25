---
id: LA-CHK-UC04
kind: use_case
title: Load the workspace in code
parent: LA-CHK-CAP04
actor: Agent
links:
  applies: [LA-CHK-DR04, LA-MOD-DR08]
---
Code such as the web app's spec API, or an agent's script, calls `loadWorkspace(root)` to get every record, link, problem and coverage figure for the repo at `root`.
