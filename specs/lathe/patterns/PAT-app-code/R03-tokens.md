---
id: LA-PAT-APP-CODE-R03
kind: pattern_rule
title: Colors and shadows are tokens
parent: LA-PAT-APP-CODE
---
A color, including a shadow's color and the backdrop behind drawers and dialogs, MUST be a custom property defined in `:root` (with its dark value in the dark theme), and every rule MUST use it through `var()`. Component inline styles MUST NOT set colors. A size several rules share, such as `--node-radius`, SHOULD be a token too.
