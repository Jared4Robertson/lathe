// The live marks in a stage's key (LA-V93-R12, LA-V94-R05): what a new record's glow and dot, a changed record's pulse
// and dot, and a removed record's ghost mean, and what the Changes lens does. Every stage's key lists them.
export function ChangesKey() {
  return (
    <ul className="plain changes-key" aria-label="Changes">
      <li><span className="change-swatch is-added" /> New as the data reloaded: a soft glow, then a dot</li>
      <li><span className="change-swatch is-changed" /> Changed as the data reloaded: a pulse in its own color, then a dot</li>
      <li><span className="change-swatch is-removed" /> Removed as the data reloaded: a ghost of its outline, fading</li>
      <li><span className="change-swatch is-lens" /> With the Changes lens on, everything unchanged is dimmed</li>
    </ul>
  );
}
