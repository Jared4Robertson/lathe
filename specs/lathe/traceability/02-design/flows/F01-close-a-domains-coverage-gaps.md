---
id: LA-TRC-F01
kind: flow
title: Read and close a domain's coverage gaps
parent: LA-TRC-CAP01
links:
  carries_out: [LA-TRC-UC01, LA-TRC-UC02, LA-TRC-UC04, LA-TRC-UC08]
---
1. The owner runs `lathe check` and reads one coverage line per domain and obligation kind: designed, built, proved and planned.
2. Each gap names the obligation and what it lacks: a component that satisfies it, or a test that proves it. Pattern rules show once in each domain that follows their pattern.
3. An agent closes each gap with a component or a test in that domain, and the next check counts it.
