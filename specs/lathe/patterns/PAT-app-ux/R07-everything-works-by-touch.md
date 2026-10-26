---
id: LA-PAT-APP-UX-R07
kind: pattern_rule
title: Everything works by touch
parent: LA-PAT-APP-UX
group: Moving around
---
The app MUST work with a finger as well as a mouse:

- **Targets:** on a coarse pointer (`@media (pointer: coarse)`), every control's target MUST be at least 44 × 44 px (`--touch-target`): the control itself, or for a control drawn small inside a row or a node (a fold chevron, a tab's close button), a `::before` stretched around it, so its look does not change. Canvas nodes, laid out by the canvas and zoomed by a pinch, and whole cards are targets of their own size.
- **No hover-only paths:** no action or information MAY be reachable only by hover. A control a hover reveals MUST show always on a coarse pointer; a tooltip only repeats a name and keys the control already has, and opens on keyboard focus too; where a click opens something at once, a tap MUST first say what it is (`LA-EXP-DR42`).
- **No sideways scroll:** no page MAY scroll sideways at 320 px wide. No rule fixes a least width wider than the phone's content (288 px) outside a wide-screen media query; long IDs wrap; wide tables and code blocks scroll in their own box.

Proved in `app/test/standards.test.tsx` by reading the stylesheet and rendering the main pages on a phone; what jsdom cannot lay out is checked in a browser at 320 and 375 px.
