---
id: LA-CHK-UC19-R04
kind: requirement
title: An obligation kind may need proof only
parent: LA-CHK-UC19
---
The engine MUST read a kind's `obligation` value `yes` or `true` as an obligation, `proof` as an obligation that needs proof only, and any other value as no obligation, in any letter case, and MUST give each kind `proof_only` in the workspace.
