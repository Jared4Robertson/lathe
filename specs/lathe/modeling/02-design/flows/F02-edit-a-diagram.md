---
id: LA-MOD-F02
kind: flow
title: Edit a diagram and watch it redraw
parent: LA-MOD
links:
  uses: [LA-MOD-V01, LA-MOD-E03]
  fulfills: [LA-MOD-UC02-R02, LA-MOD-UC02-R03, LA-MOD-UC02-R04]
  carries_out: [LA-MOD-UC02]
---
1. Jared opens the diagram at `/diagrams/<slug>` and keeps it open beside his editor.
2. He, or an agent, edits the diagram's terms or links CSV under `model/` and saves it.
3. The server announces the change, and the page reloads `GET /api/diagrams/<slug>` and redraws, with open items drawn dashed and marked `?`.
4. The header shows that every check passed, or lists every problem the edit caused.
