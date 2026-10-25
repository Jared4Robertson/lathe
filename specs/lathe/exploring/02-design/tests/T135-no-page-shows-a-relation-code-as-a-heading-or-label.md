---
id: LA-EXP-T135
kind: test
title: No page shows a relation code as a heading or label
parent: LA-EXP
test_type: unit
run_by: app/test/traceability.test.tsx
links:
  proves: [LA-EXP-V03-R07, LA-TRC-UC14-R05]
---
Opens every record of a workspace with a record of each kind and expects no heading, field label, table header, legend, label or caption to read as a relation code ("satisfies", "proves", "depends on", "proves this"), and the graph's edge, legend and connection labels and the Model view's line titles to read the meta-model's labels.
