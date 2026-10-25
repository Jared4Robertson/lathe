---
id: LA-PLT-DR19
kind: domain_rule
title: A bar keeps one height, and a scroll box its gutter
parent: LA-PLT-A2
---
A bar above content that must not move (a pane title above a canvas, the graph's trail and toolbar, the Model view's caption and key) MUST have a fixed block size, or be one line cut with an ellipsis whose whole text is its tooltip, and text that changes in it MUST be one text, so a new number never moves what follows. A box that scrolls up and down MUST keep room for its scrollbar (`scrollbar-gutter: stable`), so its content keeps its width when the scrollbar comes and goes.
