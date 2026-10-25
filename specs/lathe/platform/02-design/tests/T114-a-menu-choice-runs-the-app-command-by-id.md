---
id: LA-PLT-T114
kind: test
title: A menu choice sent by ID runs the app command
parent: LA-PLT
test_type: component
run_by: app/test/desktop-commands.test.tsx
links:
  proves: [LA-PLT-UC13-R02]
---
Stands in for the preload's `onCommand`, sends `toggleSideBar` twice and an unknown ID, and expects the side bar hidden and shown again and nothing else to happen, then expects the app to stop listening when it unmounts.
