---
id: LA-PLT-DR36
kind: domain_rule
title: The window's chrome takes only colors the shell has checked
parent: LA-PLT-A6
---
The main process MUST accept a page's chrome only as exactly `{ background, foreground }`, each an opaque hex color (`#rgb` or `#rrggbb`), and only from the window's own page. It MUST ignore anything else and leave the window as it was.
