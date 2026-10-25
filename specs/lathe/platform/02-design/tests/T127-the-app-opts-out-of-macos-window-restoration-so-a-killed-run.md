---
id: LA-PLT-T127
kind: test
title: The app opts out of macOS window restoration, so a killed run leaves nothing to reopen
parent: LA-PLT
test_type: unit
run_by: desktop/test/persistence.test.ts
links:
  proves: [LA-PLT-DR40]
---
Expects `ApplePersistenceIgnoreState` YES and `NSQuitAlwaysKeepsWindows` NO set on macOS and nothing elsewhere, and the same defaults written for the unpacked Electron by a test harness.
