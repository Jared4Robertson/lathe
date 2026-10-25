---
id: LA-BRW-UC50-R09
kind: requirement
title: The nav folds by section and shows where you are
parent: LA-BRW-UC50
---
The Diagrams and Tools sections, and each domain and folder of the current space, MUST each fold and unfold with a chevron button carrying `aria-expanded`; the section holding the current page MUST open itself. The current space MUST have no heading of its own, since the rail names it: its first row is its overview. The current page MUST be marked clearly with `aria-current="page"` and scrolled into view. Icons MUST be inline line icons; counts MUST be quiet badges, with errors red and warnings amber on Checks; long names MUST be cut short with the full name as a tooltip; items MUST be at least 32 px high. A footer MUST link the record format and say where the specs come from.
