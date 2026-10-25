---
id: LA-EXP-C46
kind: component
title: ERD model
parent: LA-EXP-LAY04
component_type: module
file: app/src/model/erd.ts
links:
  satisfies: [LA-EXP-UC11-R02, LA-EXP-UC11-R03, LA-EXP-UC11-R04, LA-EXP-DR37, LA-EXP-DR38, LA-EXP-UC11-R06, LA-EXP-UC11-R07, LA-EXP-UC11-R08, LA-EXP-DR51]
  depends_on: [LA-EXP-C57]
---
What a domain's or an aggregate's ERD draws, as plain data: the boxes (aggregates with their root and entity count, or entities with their root mark and fields; boxes from elsewhere with their owner and color), and the lines with their crow's-foot ends, one per entity relationship link on an aggregate and one per aggregate pair and direction on a domain, with the dashed `relates_to` fallback. On an aggregate, its domain events are pills, with a line from the entity raising each and the aggregates reacting to each as faded context; on a domain, one dashed "reacts to" line runs per aggregate pair and event. Also each line's geometry from box edge to box edge, the drawing of its ends, and the offsets that fan out lines between the same two boxes.
