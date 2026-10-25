---
id: LA-TRC-T113
kind: test
title: Gap callouts agree with coverage, link to their check, and a pattern rule has one line per domain
parent: LA-TRC
test_type: acceptance
run_by: app/test/traceability.test.tsx
links:
  proves: [LA-TRC-UC14-R02, LA-TRC-DR37]
---
Expects "Not proved yet" and "Not designed yet" callouts linked to the unproved and unsatisfied check pages, a pattern rule judged in each domain owing it (not built and only planned in one, designed, built and proved in the other, and a rule not applicable in a domain left out there), and every coverage gap of every domain matched by a callout.
