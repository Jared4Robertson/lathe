---
id: LA-PLT-T57
kind: test
title: A theme exports as a versioned file and imports back, and anything but known tokens is refused
parent: LA-PLT
test_type: component
run_by: app/test/themes.test.tsx
links:
  proves: [LA-PLT-UC07-R06, LA-PLT-DR11, LA-PLT-DR12, LA-PLT-DR13]
  covers: [LA-PLT-C20, LA-PLT-C25]
---
Round-trips a theme file, refuses another version or format, unknown fields, unknown tokens and values that reach past the token, fills a partial file from Lathe, and imports a file on the Appearance page as a theme of one's own.
