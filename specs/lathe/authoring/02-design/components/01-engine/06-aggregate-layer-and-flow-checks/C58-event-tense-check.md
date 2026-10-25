---
id: LA-AUT-C58
kind: component
title: Event tense check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/74-event-tense.sql
links:
  satisfies: [LA-AUT-UC12-R05, LA-AUT-DR63]
---
Warns of each domain event whose title has no past form as its last word or after its first: a word of four or more letters ending in "-ed", other than a short list of words that are not past forms, or one of the irregular past forms listed in its header.
