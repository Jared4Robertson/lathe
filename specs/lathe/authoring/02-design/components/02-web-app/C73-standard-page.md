---
id: LA-AUT-C73
kind: component
title: Standard page
parent: LA-AUT-LAY09
component_type: react component
file: app/src/specs/StandardParts.tsx
links:
  satisfies: [LA-AUT-UC16-R04, LA-AUT-UC16-R05]
  depends_on: [LA-EXP-C08]
---
A standard's Rules section: a table of its rules in ID order, each with the records that meet it, read from `meets` links and labeled by the relation's reverse label, or "Nothing yet". `RecordContent` shows it on a standard's page in place of the children list. A rule's own page needs nothing of its own: Traceability lists its incoming links under Met by, and the nav lists standards because their kinds sit in the Shared folder.
