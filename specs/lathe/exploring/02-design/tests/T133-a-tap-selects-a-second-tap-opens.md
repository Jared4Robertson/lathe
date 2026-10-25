---
id: LA-EXP-T133
kind: test
title: By touch, a first tap on a graph node selects it and a second tap or the Open chip opens it
parent: LA-EXP
test_type: acceptance
run_by: app/test/mobile.test.tsx
links:
  proves: [LA-PLT-UC07-R07, LA-EXP-DR42]
---
On a touch screen, taps a graph node and expects the address unchanged, the node outlined and a card naming it; a tap on the canvas lets go; the Open chip opens it. `isTap` reads a mouse as a click and a finger or a pen as a tap.
