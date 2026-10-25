---
id: LA-CHK-EN12
kind: entity
title: Proof claim
parent: LA-CHK-A5
role: root
links:
  refers_to: [LA-MOD-EN04]
---
One test's claim to prove one obligation, and what the test's file must say to back it.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Test | The test that makes the claim. | Record reference. | TL-LEND-T05 |
| Obligation | What it claims to prove. | Record reference. | TL-LEND-DR05 |
| Relation | The link that makes the claim. | A relation with the `proof` role. | proves |
| Test state | Whether the test runs as code, is carried out by a person, or is not written yet. | `automated`, `manual` or `planned`. | automated |
| Run by | The file that runs or carries out the test. | File path, relative to the repo root; optional for a manual or planned test. | examples/tool-library/test/domain-rules.test.ts |
| Backed by | What in the file backs the claim. | Derived: the test's own ID, every ID it proves, its key, or nothing. | Every ID it proves |
| Counts in | The domains whose coverage counts the claim. | Derived list of domains, or none. | TL-LEND |
