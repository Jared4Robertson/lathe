---
id: LA-EXP-UC10-R04
kind: requirement
title: Ctrl+Tab cycles the tabs, and the strip works as a tab list
parent: LA-EXP-UC10
---
Ctrl+Tab (`nextTab`) and Ctrl+Shift+Tab (`previousTab`) MUST activate the next and previous tab in tab order, wrapping at the ends, and with the other tab commands MUST be listed in the shortcuts sheet and the palette, their keys in tooltips and `aria-keyshortcuts`. The strip MUST be a `tablist` of `tab` elements with `aria-selected`, only the active tab in the Tab order; with a tab focused, the arrow keys, Home and End MUST move between tabs, Enter or Space MUST activate the focused one and Delete MUST close it.
