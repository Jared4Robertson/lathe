---
id: LA-CHK-UC05-R03
kind: requirement
title: A broken meta-model is reported as errors
parent: LA-CHK-UC05
---
On every load the engine MUST check the meta-model against `LA-CHK-DR02` and report each breach as an error with no record: `meta-duplicate-kind`, `meta-unknown-parent-kind`, `meta-unknown-relation-kind`, `meta-duplicate-relation` and `meta-bad-required-field`. Each message MUST name the kinds, relation or field involved. `meta-duplicate-kind` is checked within each meta-model folder and names that folder's file (`LA-CHK-DR32`); a product's extension row for a default kind widens it instead.
