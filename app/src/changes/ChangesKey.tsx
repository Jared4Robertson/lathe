// The live marks in a stage's key (LA-V93-R12, LA-V94-R05): what a new record's glow and dot, a changed record's pulse
// and dot, and a removed record's ghost mean, and what the Changes lens does. Every stage's key lists them: as lines of
// the Graph's key, or (`cells`) as a row of the ERD key's fixed cells, short words with the whole meaning as the tooltip.

const ENTRIES = [
  { mark: 'is-added', words: 'New', meaning: 'New as the data reloaded: a soft glow, then a dot' },
  { mark: 'is-changed', words: 'Changed', meaning: 'Changed as the data reloaded: a pulse in its own color, then a dot' },
  { mark: 'is-removed', words: 'Removed', meaning: 'Removed as the data reloaded: a ghost of its outline, fading' },
  { mark: 'is-lens', words: 'Lens: unchanged', meaning: 'With the Changes lens on, everything unchanged is dimmed' },
] as const;

export function ChangesKey({ cells = false }: { cells?: boolean }) {
  if (cells) {
    return (
      <ul className="erd-key-ends" aria-label="Changes">
        {ENTRIES.map((e) => <li key={e.mark} title={e.meaning}><span className={`change-swatch ${e.mark}`} /> <span className="erd-key-text">{e.words}</span></li>)}
      </ul>
    );
  }
  return (
    <ul className="plain changes-key" aria-label="Changes">
      {ENTRIES.map((e) => <li key={e.mark}><span className={`change-swatch ${e.mark}`} /> {e.meaning}</li>)}
    </ul>
  );
}
