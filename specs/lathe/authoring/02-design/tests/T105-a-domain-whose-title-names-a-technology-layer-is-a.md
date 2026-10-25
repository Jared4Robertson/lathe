---
id: LA-AUT-T105
kind: test
title: A domain whose title names a technology layer, in any letter case, is a warning that says to name the capability
parent: LA-AUT
test_type: unit
run_by: lathe/test/domain-names.test.ts
links:
  proves: [LA-AUT-DR71]
---
Expects `domain-named-for-technology` warnings for domains titled Web App, Payments API, ELECTRON shell and Reporting databases, each naming the word it found and saying to name the capability and make the technology a layer.
