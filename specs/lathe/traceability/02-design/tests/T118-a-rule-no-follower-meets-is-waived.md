---
id: LA-TRC-T118
kind: test
title: A rule no follower meets is waived in that domain, neither owed nor proved
parent: LA-TRC
test_type: unit
run_by: lathe/test/groups-and-waivers.test.ts
links:
  proves: [LA-TRC-UC04-R09, LA-TRC-DR39]
---
Expects rules that apply when scope is not single, or is many, to be left out of the coverage and warnings of a domain whose only use case gives scope single, a proof of one there to count for nothing, and both to be owed in a domain where one use case gives " Many ".
