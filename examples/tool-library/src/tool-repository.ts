// Loads and saves the Tool aggregate, whole, in the tools table: its damage report, a child kept in the
// tool's row, is `damage_note` and `damage_reported_at`, both cleared once the tool is repaired.
// Spec: the repository TL-LEND-REPO02 (examples/tool-library/data/).
import type { Database, Row } from './database.ts';
import { LendingError, type Condition } from './model.ts';
import { Tool, type NewTool } from './tool.ts';

function toTool(r: Row): Tool {
  return new Tool(Number(r.id), {
    name: String(r.name),
    description: String(r.description),
    condition: r.condition as Condition,
    damage: r.damage_note == null ? null : { note: String(r.damage_note), reportedAt: String(r.damage_reported_at) },
    addedAt: String(r.added_at),
  });
}

/** TL-LEND-REPO02: the Tool aggregate's repository. */
export class ToolRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** Saves a new tool and returns it as stored. */
  add(tool: NewTool): Tool {
    const r = this.db.sqlite
      .prepare(
        'INSERT INTO tools (name, description, condition, damage_note, damage_reported_at, added_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
      )
      .get(tool.name, tool.description, tool.condition, tool.damage?.note ?? null, tool.damage?.reportedAt ?? null, tool.addedAt) as Row;
    return toTool(r);
  }

  /** The tool with this ID; 404 `tool_not_found` when there is none. */
  get(id: number): Tool {
    const r = this.db.sqlite.prepare('SELECT * FROM tools WHERE id = ?').get(id) as Row | undefined;
    if (!r) throw new LendingError(404, 'tool_not_found', `There is no tool ${id}.`);
    return toTool(r);
  }

  /** Every tool, in ID order. */
  all(): Tool[] {
    return (this.db.sqlite.prepare('SELECT * FROM tools ORDER BY id').all() as Row[]).map(toTool);
  }

  /** Saves the tool's condition and damage report, whole, and returns it as stored. */
  save(tool: Tool): Tool {
    const r = this.db.sqlite
      .prepare('UPDATE tools SET condition = ?, damage_note = ?, damage_reported_at = ? WHERE id = ? RETURNING *')
      .get(tool.condition, tool.damage?.note ?? null, tool.damage?.reportedAt ?? null, tool.id) as Row;
    return toTool(r);
  }
}
