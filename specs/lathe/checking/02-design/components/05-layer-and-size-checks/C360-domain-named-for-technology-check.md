---
id: LA-CHK-C360
kind: component
title: Domain named for technology check
parent: LA-CHK-LAY10
component_type: sql check
file: lathe/checks/76-domain-named-for-technology.sql
links:
  satisfies: [LA-CHK-DR350]
---
Warns of each domain whose title, or whose code after the product prefix, holds a technology word as a whole word, and says which word it found where. The words are listed in its header.
