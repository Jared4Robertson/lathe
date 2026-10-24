---
id: LA-CHK-UC13
kind: use_case
title: Find stale IDs cited in prose
parent: LA-CHK-CAP01
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR70, LA-CHK-DR71, LA-CHK-DR72, LA-CHK-DR73]
---
A record's body names other records by ID in its prose, such as a use case explaining which rule it relies on. When a record is renamed, split or removed, those citations go stale without anyone noticing, which is the most common drift in S2's specs. The person runs `lathe check`; the engine reads the IDs each body cites outside code, keeps the ones that exist as the record's mentions for the app to show, and warns about each cited ID that no record has, so the wording can be fixed.
