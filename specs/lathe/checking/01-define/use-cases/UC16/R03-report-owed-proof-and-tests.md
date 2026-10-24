---
id: LA-CHK-UC16-R03
kind: requirement
title: lathe check reports owed proof and tests by state
parent: LA-CHK-UC16
---
Each obligation line of `lathe check`'s coverage report MUST end with `; N/T with a planned test` where `planned_any` differs from `planned`, and with nothing more where they are equal. After a domain's obligation lines the report MUST print one line with its tests by state, such as `LA-CHK tests: 99 automated, 0 manual, 0 planned`.
