---
id: LA-PLT-T04
kind: test
title: Init writes a config and a first product record, and refuses bad or repeated input
parent: LA-PLT
test_type: acceptance
run_by: lathe/test/cli.test.ts
links:
  proves: [LA-PLT-UC01-R01]
---
Runs `lathe init` in a new folder and expects `lathe.config.json` and a product record that passes `lathe check`; expects it to refuse an invalid or missing prefix, to leave an existing product record and config untouched, and to use an existing config's specs folder.
