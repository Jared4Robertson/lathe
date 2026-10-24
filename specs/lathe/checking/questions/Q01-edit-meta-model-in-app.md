---
id: LA-CHK-Q01
kind: question
title: "Should the meta-model be editable from the app?"
parent: LA-CHK
owner: Jared
links:
  about: [LA-CHK-A1, LA-CHK-UC05]
---
Today the meta-model is changed by editing `lathe/meta/*.csv` and reviewing the diff. Editing it from the app would make the self-improvement loop shorter, but the app would then write files, and a change could break many records at once.

Undecided: whether the app should edit the meta-model (and records) at all; if so, whether it writes the files directly or proposes a change for review; and whether it should preview which records a change would break before saving.
