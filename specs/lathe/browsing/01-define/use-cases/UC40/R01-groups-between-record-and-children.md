---
id: LA-BRW-UC40-R01
kind: requirement
title: A record with many children reaches them through one group per child kind
parent: LA-BRW-UC40
---
When a record's children include more than one kind, or more than five of one kind, the graph MUST put a group node per child kind between the record and those children, labeled with the kind's plural label and the number of members, such as "Use cases (5)". A group MUST be drawn like a folder, differently from records. The parent/child spine MUST run record, group, record, while every other link (satisfies, proves and so on) MUST still run record to record. Groups MUST NOT count as a hop for the depth, except the group at the center: its parent and its members are one hop from it. Hiding a kind hides its groups, hiding the parent/child relation hides every group, and trace mode MUST show no groups.
