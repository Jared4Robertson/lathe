---
id: LA-BRW-EN10
kind: entity
title: Command
parent: LA-BRW-A7
role: root
links:
  has_many: [LA-BRW-EN11, LA-BRW-EN12]
---
Something a person can do from anywhere in the app, listed once in the keymap.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Command ID | The command's name in the keymap. | Text, unique. | commandPalette |
| Title | What it does, as the palette and the shortcuts sheet show it. | Text. | Command palette |
| Group | Where the shortcuts sheet lists it. | Navigate, View, Graph or Lists. | Navigate |
| Context | Where it applies. | Anywhere, on a page, while the graph shows, or in a list. | Anywhere |
| Handled by | Who acts on its keys. | The app, the component it belongs to, or the browser. | The app |
