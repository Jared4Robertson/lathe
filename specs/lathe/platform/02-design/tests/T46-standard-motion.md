---
id: LA-PLT-T46
kind: test
title: "Motion is shared and optional: every transition and animation uses the motion or hover tokens and is turned off under reduced motion"
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-UX-R04]
---
Reads every style rule in `app/src/styles.css` that sets a transition or animation and expects its times and easing to come from `--motion-speed`, `--motion-ease` or `--hover-speed`, and each such selector to be turned off by a `prefers-reduced-motion: reduce` rule or to apply only under `no-preference`. Expects the tokens to be defined, and code that animates frame by frame to take its timing from `readMotion()`, which reads them and checks `prefers-reduced-motion`.
