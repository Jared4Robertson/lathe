---
id: LA-EXP-UC04-R01
kind: requirement
title: Folders and records with several kinds of children are reached through one group each
parent: LA-EXP-UC04
---
The graph MUST draw the nav's stages and folders as group nodes, and when a record's children, or a folder's records, include more than one kind the nav lists side by side, MUST put a group node per kind between them, labeled with the kind's plural label and the number of members, such as "Use cases (5)". A group MUST be drawn like a folder, differently from records. The parent/child spine MUST run record, group, record, while every cross-link (satisfies, proves and so on) MUST still run record to record. Every group is a level for the depth. Hiding a kind hides its kind groups (a stage or named folder has no kind of its own), hiding the parent/child relation hides every group, and trace mode MUST show no groups.
