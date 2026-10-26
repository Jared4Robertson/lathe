---
id: LA-EXP-UC04-R03
kind: requirement
title: A group has its own address and can be the center
parent: LA-EXP-UC04
group: Groups
---
A group MUST be the focus at its own address: a stage or folder at `/<domain-id>/<stage>[/<folder>]`, for example `/TL-LEND/define/use-cases`, and a kind group at `/<parent-id>/<kind>`. At depth 1 the camera MUST frame its parent at the left edge and all its members to the right, and depth counts levels from it as from a record. Its side bar names the parent and lists every member. The focused record's side bar MUST link to its groups. The breadcrumb trail and the browser's Back button MUST work for groups as for records. An address for a group that does not exist MUST say so.
