---
id: LA-BRW-UC51-R01
kind: requirement
title: One keymap table drives the keys, the palette and the sheet
parent: LA-BRW-UC51
---
Every keyboard command MUST be one row in one table (command id, title, group, default keys, where it applies), and the key handlers, the command palette and the shortcuts sheet MUST all be drawn from it, so nothing is listed twice. "Mod" MUST mean Cmd on macOS and Ctrl elsewhere, in matching and in what the app shows (⌘⇧P on a Mac, Ctrl+Shift+P elsewhere).
