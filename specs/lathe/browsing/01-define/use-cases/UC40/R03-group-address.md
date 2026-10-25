---
id: LA-BRW-UC40-R03
kind: requirement
title: A group has its own address and can be the center
parent: LA-BRW-UC40
---
A group MUST be the focus at `/records/<parent-id>/<kind>`, for example `/records/TL-LEND/use_case` (old `/graph/...` links redirect there), showing the parent to the left and all the group's members to the right; at depth 1 it MUST show only those, not the parent's other groups or the members' own groups, which depth 2 adds; with an inspector that names the parent and lists every member. The focused record's inspector MUST link to its groups. The breadcrumb trail and the browser's Back button MUST work for groups as for records. An address for a group that does not exist MUST say so.
