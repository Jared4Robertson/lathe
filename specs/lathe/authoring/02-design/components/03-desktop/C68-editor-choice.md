---
id: LA-AUT-C68
kind: component
title: Editor choice
parent: LA-AUT-LAY10
component_type: module
file: desktop/src/editor.ts
links:
  satisfies: [LA-AUT-UC15-R02]
---
The editor Open in editor uses, kept in `settings.json` in the user data folder (`parseSettings`), and how to open a file in it (`editorLaunch`): a known editor by its bundle ID on macOS (`open -b`) or its command elsewhere, the system's default app, or a custom command run in a login shell with the file as an argument.
