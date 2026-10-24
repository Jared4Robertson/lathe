# Lathe: Domain Model

The domain model as a diagram. It's written in Mermaid, a text format that GitHub and most editors render as a picture, so we can change it by editing text. Terms are defined in [NOTES.md](NOTES.md).

```mermaid
flowchart LR
  subgraph ctx["People & Tools context"]
    direction LR
    subgraph person["Person (aggregate)"]
      exp["Experience (entity)"]
      val["Value (value object)"]
      goal["Goal (value object)"]
    end
    subgraph tool["Tool (aggregate)"]
      tpurpose["Purpose (value object)"]
      cond["Condition (value object)"]
      fit["Fitness (value object, assigned by the Person served)"]
      serves["Serves: Person ID"]
    end
    action(["Action (domain event)"])
    occ(["Occurrence (domain event)"])
  end

  subgraph sw["Making software context (later)"]
    software["Software"]
    lathe["Lathe"]
  end

  person -- raises --> action
  tool -- "raises, on a Person's behalf" --> action
  action -- prompts --> exp
  occ -- prompts --> exp
  action -- changes --> cond
  occ -- changes --> cond
  action -- "assigns (by the Person served)" --> fit
  serves -. references .-> person
  software -. "is a kind of" .-> tool
  lathe -. "is a kind of" .-> tool
```

## How to read it
- **Boxes inside a frame** belong to that aggregate.
- **Rounded shapes** are domain events: records that something happened.
- **Solid arrows** show what raises or prompts what. **Dotted arrows** are references or "is a kind of".
- The **Making software context** sits outside the foundational context and builds on it.
