---
id: LA-AUT-UC03-R03
kind: requirement
title: A broken meta-model is reported as errors
parent: LA-AUT-UC03
---
On every load the engine MUST check the meta-model against `LA-AUT-DR09` and report each breach as an error with no record: `meta-duplicate-kind`, `meta-unknown-parent-kind`, `meta-unknown-relation-kind`, `meta-duplicate-relation` and `meta-bad-required-field`. Each message MUST name the kinds, relation or field involved. `meta-duplicate-kind` is checked within each meta-model folder and names that folder's file (`LA-AUT-DR14`); a product's extension row for a default kind widens it instead.
