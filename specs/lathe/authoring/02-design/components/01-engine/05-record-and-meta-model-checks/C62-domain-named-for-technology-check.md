---
id: LA-AUT-C62
kind: component
title: Domain named for technology check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/76-domain-named-for-technology.sql
links:
  satisfies: [LA-AUT-DR71]
---
Warns of each domain whose title, or whose code after the product prefix, holds a technology word as a whole word, and says which word it found where. The words are listed in its header.
