---
id: LA-PAT-APP-UX-R04
kind: pattern_rule
title: Motion is shared and optional
parent: LA-PAT-APP-UX
---
Every transition and animation MUST take its time and easing from the shared tokens in `:root`: `--motion-speed` and `--motion-ease` for things that move or fade, and `--hover-speed` for hover. Each one MUST be turned off when the system asks for reduced motion, by a `prefers-reduced-motion: reduce` rule for the same selector or by applying only under `prefers-reduced-motion: no-preference`. Animation in JS MUST read the same tokens and check `matchMedia('(prefers-reduced-motion: reduce)')`, jumping straight to the end when it matches; `readMotion()` in `app/src/graph/motion.ts` does both. Motion only helps the eye follow a change: nothing may depend on it.
