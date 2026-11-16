import type { ModeChoice, Theme } from '../../theme/theme';
import { themesTableFrom, type ThemesSource, type ThemesTable } from './read-model';

/** The reads the Themes queries need. */
export interface ThemesReader {
  themes(): readonly Theme[];
  theme(id: string): Theme | undefined;
  active(): Theme;
  mode(): ModeChoice;
}

class InMemoryThemesReader implements ThemesReader {
  readonly table: ThemesTable;
  constructor(table: ThemesTable) { this.table = table; }
  themes() { return this.table.themes; }
  theme(id: string) { return this.table.byId.get(id); }
  active() { return this.table.active; }
  mode() { return this.table.mode; }
}

/** The Themes reader over a table built from the kept Appearance. */
export const themesReader = (source: ThemesSource): ThemesReader => new InMemoryThemesReader(themesTableFrom(source));
