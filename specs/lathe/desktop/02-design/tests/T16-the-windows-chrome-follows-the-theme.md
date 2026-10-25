---
id: LA-DSK-T16
kind: test
title: The window's chrome follows the theme
parent: LA-DSK
test_type: component
run_by: app/test/desktop-title-bar.test.tsx
links:
  proves: [LA-DSK-UC04-R06]
---
Stands in for `setChrome`, opens the app and expects the Lathe theme's shell and ink; then chooses Midnight and expects its shell, every color an opaque `#rrggbb`.
