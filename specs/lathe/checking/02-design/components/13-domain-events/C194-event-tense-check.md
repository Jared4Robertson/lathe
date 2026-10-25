---
id: LA-CHK-C194
kind: component
title: Event tense check
parent: LA-CHK-LAY13
component_type: sql check
file: lathe/checks/74-event-tense.sql
links:
  satisfies: [LA-CHK-UC26-R05, LA-CHK-DR198]
---
Warns of each domain event whose title has no past form as its last word or after its first: a word of four or more letters ending in "-ed", other than a short list of words that are not past forms, or one of the irregular past forms listed in its header.
