---
id: LA-BRW-T560
kind: test
title: Events sit under their aggregate through a "Domain events" group, are drawn as spark pills, and their reacts_to links are dashed, labeled from the meta-model and drawn with the Links switch
parent: LA-BRW
test_type: component
run_by: app/test/domain-events.test.tsx
links:
  proves: [LA-BRW-UC40-R07, LA-BRW-DR307]
---
Expects the graph's tree to put an aggregate's events under its "Domain events" group, the Links switch to add an event's reacts_to and raised_by edges (and not without it), and their line style to be `event`. Renders the graph on an event, turns Links on, and expects the dashed spark edges labeled "Reacts to" and "Raised by", the event node as a spark pill and its group as a plain group.
