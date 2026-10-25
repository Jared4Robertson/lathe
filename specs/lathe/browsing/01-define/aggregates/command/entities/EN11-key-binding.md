---
id: LA-BRW-EN11
kind: entity
title: Key binding
parent: LA-BRW-A7
role: child
---
One chord or sequence that runs the command, never shared with another command active at the same time.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Keys | The chord, or chords in sequence, as the keymap writes them. | Text: a chord such as Mod+Shift+P, or chords separated by spaces. | Mod+Shift+P |
| Override | The person's own binding in its place, if any. | Text, or none. | None |
| On a Mac | How a Mac shows it. | Derived: symbols in Apple's order. | ⇧⌘P |
| Elsewhere | How other platforms show it. | Derived: words joined by +. | Ctrl+Shift+P |
| ARIA name | What `aria-keyshortcuts` says. | Derived: DOM modifier names, or none for a sequence. | Control+Shift+P |
