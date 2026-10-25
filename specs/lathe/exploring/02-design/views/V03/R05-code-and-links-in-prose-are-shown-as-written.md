---
id: LA-EXP-V03-R05
kind: interaction_requirement
title: Code and links in prose are shown as written
parent: LA-EXP-V03
links:
  fulfills: [LA-TRC-UC12-R01]
---
Turning cited IDs into links MUST NOT change text inside code blocks, links the author wrote, or code spans holding anything besides one ID; a code span holding one lone cited ID is wrapped in the link with its code style kept, and MUST run only on the sanitized HTML.
