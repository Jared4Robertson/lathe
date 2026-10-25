---
id: LA-PLT-C58
kind: component
title: Window restoration opt-out
parent: LA-PLT-LAY09
component_type: module
file: desktop/src/persistence.ts
links:
  satisfies: [LA-PLT-DR40]
---
Sets `ApplePersistenceIgnoreState` to YES and `NSQuitAlwaysKeepsWindows` to NO in the app's own user defaults before the app is ready, on macOS only; the smoke test writes the same defaults for the unpacked Electron before it launches it.
