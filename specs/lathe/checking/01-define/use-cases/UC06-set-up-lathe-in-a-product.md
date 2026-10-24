---
id: LA-CHK-UC06
kind: use_case
title: Set up Lathe in a product repo
parent: LA-CHK-CAP04
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR01]
---
Lathe is installed into a product's own repo as a package, so the product's specs live beside its code and Lathe's improvements arrive with a version bump instead of by copying.

1. The person installs the Lathe package in the product repo and runs `lathe init` with the product's name and ID prefix.
2. They write records in the product's specs folder and run `lathe check`.
3. They run `lathe serve` to browse the specs and diagrams.
