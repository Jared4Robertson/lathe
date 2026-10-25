---
id: LA-AUT-EN08
kind: entity
title: Entity
parent: LA-AUT-A3
role: child
links:
  has_many: [LA-AUT-EN07]
---
One record an aggregate keeps, as one box of its ERD: the aggregate's root or one of its parts.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the entity's number. | Text in the ID format. | TL-LEND-EN02 |
| Role | Whether it is the aggregate's root or a part. | `root` or `child`. | root |
| Has one, has many, refers to | Its links to other entities, drawn as the ERD's edges. | Lists of entity references. | TL-LEND-EN03 |
