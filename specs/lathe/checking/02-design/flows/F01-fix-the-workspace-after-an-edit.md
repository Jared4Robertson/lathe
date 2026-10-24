---
id: LA-CHK-F01
kind: flow
title: Fix the workspace after an edit
parent: LA-CHK-CAP01
links:
  carries_out: [LA-CHK-UC01, LA-CHK-UC03, LA-CHK-UC08, LA-CHK-UC12, LA-CHK-UC13]
---
1. An agent edits records, then runs `lathe check` (the Claude Code plugin's hook runs it after every spec edit).
2. The check prints errors first: broken records, tests whose files do not back what they claim to prove, and IDs cited in prose that no longer exist. The agent fixes each and runs the check again until there are no errors.
3. When a rule Lathe does not know yet keeps coming up, the agent adds a check: one SQL file in `lathe/checks/`, run in name order with the others.
4. The agent hands the work back to Jared with the check's last lines, so he can see what is still to do.
