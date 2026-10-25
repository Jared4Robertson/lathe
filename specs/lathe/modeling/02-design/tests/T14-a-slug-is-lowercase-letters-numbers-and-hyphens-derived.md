---
id: LA-MOD-T14
kind: test
title: A slug is lowercase letters, numbers and hyphens, derived from the title
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR01, LA-MOD-UC01-R01]
---
Derives slugs from titles with capitals, punctuation, slashes, line breaks and non-Latin letters, and expects only lowercase letters, numbers and single hyphens, at most 60 characters.
