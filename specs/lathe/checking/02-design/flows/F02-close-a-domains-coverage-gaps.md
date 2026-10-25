---
id: LA-CHK-F02
kind: flow
title: Read and close a domain's coverage gaps
parent: LA-CHK-CAP02
links:
  carries_out: [LA-CHK-UC02, LA-CHK-UC07, LA-CHK-UC11, LA-CHK-UC20]
---
1. The owner runs `lathe check` and reads one coverage line per domain and obligation kind: designed, built, proved and planned.
2. Each gap names the obligation and what it lacks: a component that satisfies it, or a test that proves it. Pattern rules show once in each domain that follows their pattern.
3. An agent closes each gap with a component or a test in that domain, and the next check counts it.
