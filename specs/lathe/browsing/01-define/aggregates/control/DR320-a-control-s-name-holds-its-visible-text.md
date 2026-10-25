---
id: LA-BRW-DR320
kind: domain_rule
title: "A control's name holds its visible text"
parent: LA-BRW-A13
---
A control's accessible name MUST contain the text it shows, so a person who says what they see, or hears the name read, finds the same control. Where a control shows a count or a mark, the name is built from what is shown, with words for a screen reader added beside it in hidden text (`sr-only`), rather than an `aria-label` that says something else: the nav's Checks row is named "Checks 3 errors 12 warnings", and a space's button, which shows a monogram the reader is not meant to hear, is named by its product's title in hidden text, with the mark hidden. An `aria-label` that stays MUST include the shown text as a word: "Open pages: 2".
