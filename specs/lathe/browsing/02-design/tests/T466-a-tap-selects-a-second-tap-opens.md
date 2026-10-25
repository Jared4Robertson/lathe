---
id: LA-BRW-T466
kind: test
title: By touch, a first tap on a graph node selects it and a second tap or the Open chip opens it
parent: LA-BRW
test_type: acceptance
run_by: app/test/mobile.test.tsx
links:
  proves: [LA-BRW-UC116-R07, LA-BRW-DR222]
---
On a touch screen, taps a graph node and expects the address unchanged, the node outlined and a card naming it; a tap on the canvas lets go; the Open chip opens it. `isTap` reads a mouse as a click and a finger or a pen as a tap.
