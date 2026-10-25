---
id: LA-PLT-UC01
kind: use_case
title: Set up Lathe in a product repo
parent: LA-PLT-CAP03
actor: Owner, Agent
links:
  applies: [LA-AUT-DR08]
---
Lathe is installed into a product's own repo as a package, so the product's specs live beside its code and Lathe's improvements arrive with a version bump instead of by copying.

1. The person installs the Lathe package in the product repo and runs `lathe init` with the product's name and ID prefix.
2. They write records in the product's specs folder and run `lathe check`.
3. They run `lathe serve` to browse the specs.
