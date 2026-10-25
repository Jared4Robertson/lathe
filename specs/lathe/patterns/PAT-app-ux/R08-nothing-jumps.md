---
id: LA-PAT-APP-UX-R08
kind: pattern_rule
title: Nothing jumps
parent: LA-PAT-APP-UX
---
Nothing on screen MAY move unless the Reader moved it or it moves by a deliberate motion on the shared tokens (`LA-PAT-APP-UX-R04`). In every scenario of the stability suite (`app/stability`, run by `npm --prefix app run test:stability`), the layout shifts that the step does not mean to make MUST add up to 0.01 or less, counting the shifts just after input that CLS leaves out, and the key elements of the page (the nav, the pane bars and titles, the canvases, the inspector) MUST keep their boxes: they never move, jump back, or get thrown away and drawn anew. The causes that show in the source are checked without a browser too: every scroll box sets `scrollbar-gutter: stable`; a bar above a canvas has a fixed block size or is one line cut with an ellipsis; a count or caption that changes is one text; a canvas stays mounted while its content changes and is fitted before its first paint; and what one part tells another (the graph telling the inspector what it connects) arrives before paint. The causes and their fixes are listed in `notes/jitter-audit.md`.
