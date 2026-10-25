---
id: LA-CHK-T680
kind: test
title: "A domain whose title names a technology layer, in any letter case, is a warning that says to name the capability"
parent: LA-CHK
test_type: unit
run_by: lathe/test/domain-names.test.ts
links:
  proves: [LA-CHK-DR350]
---
Expects `domain-named-for-technology` warnings for domains titled Web App, Payments API, ELECTRON shell and Reporting databases, each naming the word it found and saying to name the capability and make the technology a layer.
