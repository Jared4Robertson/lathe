---
id: LA-CHK-C09
kind: component
title: Relation allowed check
parent: LA-CHK-LAY03
component_type: sql check
file: lathe/checks/11-relation-not-allowed.sql
links:
  satisfies: [LA-CHK-UC04-R07, LA-CHK-DR06]
---
The `relation-not-allowed` check, one row per link: a link is reported only when no record with the target ID makes it allowed, and the message names every kind the ID has.
