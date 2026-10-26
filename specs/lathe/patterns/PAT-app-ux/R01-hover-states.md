---
id: LA-PAT-APP-UX-R01
kind: pattern_rule
title: Everything clickable shows a hover state
parent: LA-PAT-APP-UX
group: Look and feel
---
Anything the pointer can click (a card, a graph node, a row in a menu, a button) MUST change when the pointer is over it, and only clickable things MAY. Every hover uses the shared tokens in `:root`: `--hover-bg` tints rows and plain buttons, `--hover-ring` rings cards and graph nodes, and `--hover-speed` times the change, which reduced motion turns off. A card that leads to one place is one link: its title's link stretches over the whole card. A graph node that is not clickable, such as the center or a file, keeps the default cursor and no hover.
