import { useEffect, useId, useState, type CSSProperties, type ChangeEvent } from 'react';
import { Button, buttonClass } from '../components/Button';
import { Link, navigate } from '../router';
import { ToolPanelFrame } from '../views/ToolPanel';
import { turnScrollToZoomOnOrOff } from '../platform/appearance/commands/turn-scroll-to-zoom-on-or-off';
import { useScrollToZoom } from '../platform/appearance/use-scroll-to-zoom';
import { panelHref } from '../views/overlays';
import { shownMode } from './apply';
import { auditContrast } from './audit';
import { formatRatio, parseColor, toHex } from './contrast';
import { themeVars } from './css';
import { ThemeChip } from './ThemeCommands';
import { useThemes } from './ThemeProvider';
import { MODE_CHOICES, MODE_LABELS, resolvedValue, tokenValue, type Mode, type Theme, type ThemeFile } from './theme';
import {
  COLOR_GROUPS,
  COLOR_TOKENS,
  DENSITY,
  FONT_CHOICES,
  GAP,
  MOTION,
  RADIUS,
  TEXT_SIZE,
  isColorValue,
  isSettingValue,
  pxOf,
  type ColorToken,
  type SettingToken,
} from './tokens';

// Appearance, a tool over the stage (LA-V62, LA-PAT-APP-UX-R20): a popover anchored to its button at the
// foot of the nav (`?panel=appearance`) with the Light, Dark or System choice, Scroll to zoom, and the themes, each
// previewed live on the stage while it is pointed at or focused, and kept with a click; and, for a
// theme of one's own (duplicated from another), the editor, a larger panel over the stage
// (`?panel=theme&theme=<id>`). Every change shows at once on the whole app around them, which is the
// live preview, and is kept as it is made. On a phone each is a bottom sheet.

const LABELS = Object.fromEntries(COLOR_TOKENS.map((t) => [t.name, t.label.split(',')[0]]));

/** The Appearance popover: the mode, Scroll to zoom, then the themes, and importing one from a file. */
export function AppearancePopover({ sheet, onClose }: { sheet: boolean; onClose: () => void }) {
  return (
    <ToolPanelFrame label="Appearance" className="appearance-popover" sheet={sheet} onClose={onClose}>
      <div className="spec-body appearance-body">
        <ModeSection />
        <ScrollSection />
        <ThemeList />
      </div>
    </ToolPanelFrame>
  );
}

/** The theme editor: a larger panel over the stage, for a theme of one's own. */
export function ThemeEditorPanel({ id, sheet, onClose }: { id: string | null; sheet: boolean; onClose: () => void }) {
  const { themes } = useThemes();
  const theme = themes.find((t) => t.id === id && !t.builtIn) ?? null;
  return (
    <ToolPanelFrame label={theme ? `Edit “${theme.name}”` : 'Edit a theme'} className="theme-panel" sheet={sheet} onClose={onClose}>
      <div className="spec-body appearance-body">
        {theme
          ? <ThemeEditor key={theme.id} theme={theme} />
          : <p className="hint">There's no theme of yours to edit here. <Link to={panelHref('appearance')}>Choose or duplicate a theme</Link>.</p>}
      </div>
    </ToolPanelFrame>
  );
}

function ModeSection() {
  const { mode, setMode } = useThemes();
  const name = useId();
  return (
    <section className="spec-section" aria-labelledby={`${name}-h`}>
      <h3 id={`${name}-h`}>Light, dark or system</h3>
      <div className="segmented" role="radiogroup" aria-labelledby={`${name}-h`}>
        {MODE_CHOICES.map((m) => (
          <label key={m} className={`segment${mode === m ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={m} checked={mode === m} onChange={() => setMode(m)} />
            {MODE_LABELS[m]}
          </label>
        ))}
      </div>
      <p className="hint">{mode === 'system' ? `Following the system, which is ${shownMode('system')} now.` : `Always ${mode}, whatever the system says.`}</p>
    </section>
  );
}

/** Scroll to zoom (LA-V62-R05): whether scroll zooms the stages' cameras or pans them, kept at once. */
function ScrollSection() {
  const on = useScrollToZoom();
  const name = useId();
  return (
    <section className="spec-section" aria-labelledby={`${name}-h`}>
      <h3 id={`${name}-h`}>Scroll</h3>
      <label className="setting-switch">
        <input type="checkbox" role="switch" checked={on} aria-describedby={`${name}-d`} onChange={(e) => turnScrollToZoomOnOrOff({ on: e.target.checked })} />
        Scroll to zoom
      </label>
      <p id={`${name}-d`} className="hint">{on
        ? 'Scroll zooms the Graph, the ERD and the Trace; Cmd or Ctrl with scroll pans.'
        : 'Scroll pans the Graph, the ERD and the Trace; Cmd or Ctrl with scroll zooms.'}</p>
    </section>
  );
}

/** A small picture of the app in a theme's colors and fonts: the shell, the nav and a page. */
function ThemePreview({ theme, mode }: { theme: ThemeFile; mode: Mode }) {
  return (
    <div className="theme-preview" style={themeVars(theme, mode) as CSSProperties} aria-hidden="true">
      <span className="tp-nav"><span className="tp-line tp-current" /><span className="tp-line" /><span className="tp-line" /></span>
      <span className="tp-page">
        <span className="tp-title">Aa</span>
        <span className="tp-line tp-muted" />
        <span className="tp-marks"><span className="tp-accent" /><span className="tp-spark" /><span className="tp-warn" /></span>
      </span>
    </div>
  );
}

/**
 * The themes: each a row that previews it live on the stage while pointed at or focused, and keeps it
 * when clicked; a built-in theme duplicates to edit, one's own opens in the editor; any exports to a file.
 */
function ThemeList() {
  const { themes, active, choose, duplicate, exportFile, importFile, mode, preview } = useThemes();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const heading = useId();
  const shows = shownMode(mode);
  // A preview never outlives the list.
  useEffect(() => () => preview(null), [preview]);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = importFile(await file.text());
    setMessage(result.ok ? { ok: true, text: `Added “${result.theme.name}”.` } : { ok: false, text: result.error });
  };

  return (
    <section className="spec-section" aria-labelledby={heading}>
      <div className="spec-section-head">
        <h3 id={heading}>Themes</h3>
        <div className="spec-section-actions">
          <label className={buttonClass('ghost', { className: 'file-button' })}>
            Import
            <input type="file" accept=".json,application/json" aria-label="Import a theme file" onChange={onImport} />
          </label>
        </div>
      </div>
      {message && <p className={message.ok ? 'hint' : 'error inline-error'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
      <ul className="theme-rows" aria-label="Themes" onMouseLeave={() => preview(null)}>
        {themes.map((t) => (
          <li key={t.id} className={`theme-row${t.id === active.id ? ' is-on' : ''}`}>
            <Button
              className="theme-pick"
              aria-pressed={t.id === active.id}
              aria-label={`Use ${t.name}`}
              onClick={() => { preview(null); choose(t.id); }}
              onMouseEnter={() => preview({ theme: t })}
              onFocus={() => preview({ theme: t })}
              onBlur={() => preview(null)}
            >
              <ThemeChip theme={t} mode={shows} />
              <span className="theme-row-text">
                <span className="theme-row-name">{t.name}</span>
                {/* A note beside the name, drawn by the stylesheet, so the button's text is its name (LA-V61-R44); In use is its pressed state. */}
                <small className="theme-row-state" data-state={t.id === active.id ? 'In use' : t.builtIn ? 'Built in' : 'Yours'} aria-hidden="true" />
              </span>
            </Button>
            <span className="theme-actions">
              {t.builtIn
                ? <Button label={`Duplicate and edit ${t.name}`} onClick={() => { preview(null); navigate(panelHref('theme', duplicate(t.id))); }}>Duplicate</Button>
                : <Link to={panelHref('theme', t.id)} className={buttonClass()} aria-label={`Edit ${t.name}`} onClick={() => { preview(null); choose(t.id); }}>Edit</Link>}
              <Button label={`Export ${t.name}`} onClick={() => download(t.name, exportFile(t.id))}>Export</Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function download(name: string, text: string) {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme'}.lathe-theme.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ---------- The editor ----------

function ThemeEditor({ theme }: { theme: Theme }) {
  const { update, remove, reset, basedOn, exportFile, choose, active } = useThemes();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const base = basedOn(theme.id);

  // The theme being edited is the one in use, so the whole app shows each change.
  // On opening only, so the theme picker can still choose another while the editor is open.
  useEffect(() => { if (active.id !== theme.id) choose(theme.id); }, [theme.id]);

  const setColor = (mode: Mode, token: string, value: string | null) => update(theme.id, (f) => {
    const set = { ...f[mode] };
    if (value === null) delete set[token];
    else set[token] = value;
    return { ...f, [mode]: set };
  });
  const setToken = (token: SettingToken, value: string) => update(theme.id, (f) => ({ ...f, tokens: { ...f.tokens, [token]: value } }));

  return (
    <div className="theme-editor">
      <div className="spec-section-head">
        <div className="spec-section-actions">
          <Button onClick={() => download(theme.name, exportFile(theme.id))}>Export</Button>
          <Button onClick={() => reset(theme.id)}>Reset to {base.name}</Button>
          {confirmDelete ? (
            <span className="confirm" role="group" aria-label="Confirm delete">
              <span>Delete “{theme.name}”?</span>
              <Button danger onClick={() => { remove(theme.id); navigate(panelHref('appearance')); }}>Delete</Button>
              <Button onClick={() => setConfirmDelete(false)}>Keep</Button>
            </span>
          ) : (
            <Button danger onClick={() => setConfirmDelete(true)}>Delete…</Button>
          )}
          <Link to={panelHref('appearance')} className={buttonClass('primary')}>Done</Link>
        </div>
      </div>

      <NameField theme={theme} onRename={(name) => update(theme.id, (f) => ({ ...f, name }))} />

      <div className="theme-editor-previews">
        <figure><ThemePreview theme={theme} mode="light" /><figcaption>Light</figcaption></figure>
        <figure><ThemePreview theme={theme} mode="dark" /><figcaption>Dark</figcaption></figure>
      </div>

      <h4>Colors</h4>
      {COLOR_GROUPS.map((group) => (
        <fieldset key={group} className="theme-group">
          <legend>{group}</legend>
          <div className="color-rows" role="table" aria-label={`${group} colors`}>
            <div className="color-row color-head" role="row">
              <span role="columnheader">Token</span><span role="columnheader">Light</span><span role="columnheader">Dark</span>
            </div>
            {COLOR_TOKENS.filter((t) => t.group === group).map((t) => (
              <div key={t.name} className="color-row" role="row">
                <span role="rowheader" className="color-name">{t.label} <code>{t.name}</code></span>
                {(['light', 'dark'] as const).map((mode) => (
                  <span role="cell" key={mode}><ColorField theme={theme} token={t} mode={mode} onChange={(v) => setColor(mode, t.name, v)} /></span>
                ))}
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <h4>Type</h4>
      <div className="setting-grid">
        <FontField label="Headings" token="--display" theme={theme} onChange={setToken} />
        <FontField label="Text" token="--body" theme={theme} onChange={setToken} />
        <FontField label="Code" token="--mono" theme={theme} onChange={setToken} />
        <RangeField label="Text size" token="--text-size" theme={theme} min={TEXT_SIZE.min} max={TEXT_SIZE.max} step={0.5} onChange={setToken} />
      </div>

      <h4>Shape and density</h4>
      <div className="setting-grid">
        <RangeField label="Panel corner radius" token="--panel-radius" theme={theme} min={RADIUS.min} max={RADIUS.max} step={1} onChange={setToken} />
        <RangeField label="Gap between panels" token="--panel-gap" theme={theme} min={GAP.min} max={GAP.max} step={1} onChange={setToken} />
        <Choice
          label="Density"
          value={Number(tokenValue(theme, 'light', '--density')) < DENSITY.comfortable ? 'compact' : 'comfortable'}
          options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]}
          onChange={(v) => setToken('--density', String(v === 'compact' ? DENSITY.compact : DENSITY.comfortable))}
        />
      </div>

      <h4>Motion</h4>
      <Choice
        label="Motion"
        value={tokenValue(theme, 'light', '--motion-speed') === MOTION.off ? 'reduced' : 'system'}
        options={[['system', 'Follow the system'], ['reduced', 'Always reduced']]}
        onChange={(v) => update(theme.id, (f) => ({
          ...f,
          tokens: { ...f.tokens, '--motion-speed': v === 'reduced' ? MOTION.off : MOTION.speed, '--hover-speed': v === 'reduced' ? MOTION.off : MOTION.hover },
        }))}
      />
    </div>
  );
}

function NameField({ theme, onRename }: { theme: Theme; onRename: (name: string) => void }) {
  const { themes } = useThemes();
  const [draft, setDraft] = useState(theme.name);
  const id = useId();
  const trimmed = draft.trim();
  const problem = !trimmed ? 'A theme needs a name.' : trimmed.length > 60 ? 'Keep the name to 60 characters.' : themes.some((t) => t.id !== theme.id && t.name === trimmed) ? 'Another theme has this name.' : null;
  const commit = () => { if (!problem && trimmed !== theme.name) onRename(trimmed); };
  return (
    <div className="setting">
      <label htmlFor={id}>Name</label>
      <input id={id} type="text" value={draft} aria-invalid={!!problem} aria-describedby={problem ? `${id}-p` : undefined} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      {problem && <p id={`${id}-p`} className="field-problem">{problem}</p>}
    </div>
  );
}

function ColorField({ theme, token, mode, onChange }: { theme: Theme; token: ColorToken; mode: Mode; onChange: (value: string | null) => void }) {
  const own = theme[mode][token.name];
  const shown = tokenValue(theme, mode, token.name) ?? '';
  const resolved = parseColor(resolvedValue(theme, mode, token.name) ?? '');
  const [draft, setDraft] = useState(own ?? '');
  useEffect(() => setDraft(own ?? ''), [own]);
  const invalid = draft.trim() !== '' && !isColorValue(draft);
  const label = `${token.label.split(',')[0]}, ${mode}`;
  const commit = () => {
    const v = draft.trim();
    if (v === (own ?? '') || invalid) return;
    if (v === '' && token.core) { setDraft(own ?? ''); return; }
    onChange(v === '' ? null : v);
  };
  const warnings = auditContrast(theme, mode).filter((c) => c.token === token.name && !c.ok);
  return (
    <span className="color-field">
      <span className="color-inputs">
        <input type="color" className="color-swatch" aria-label={label} value={resolved ? toHex(resolved) : '#000000'} onChange={(e) => onChange(e.target.value)} />
        <input
          type="text"
          className="color-text"
          aria-label={`${label}, value`}
          aria-invalid={invalid}
          spellCheck={false}
          value={draft}
          placeholder={own === undefined ? `${shown}${mode === 'dark' && theme.light[token.name] ? ' (as light)' : ''}` : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        />
        {!token.core && own !== undefined && (
          <Button variant="icon" className="color-clear" label={`Clear ${label}`} title="Clear: follow the default" onClick={() => onChange(null)}>×</Button>
        )}
      </span>
      {warnings.map((w) => (
        <span key={w.bg} className="contrast-warning">
          {formatRatio(w.ratio)} on {LABELS[w.bg] ?? w.bg}; needs {w.min}:1
        </span>
      ))}
    </span>
  );
}

function FontField({ label, token, theme, onChange }: { label: string; token: '--display' | '--body' | '--mono'; theme: Theme; onChange: (t: SettingToken, v: string) => void }) {
  const id = useId();
  const value = tokenValue(theme, 'light', token) ?? '';
  const kind = token === '--display' ? 'display' : token === '--body' ? 'body' : 'mono';
  const choices = FONT_CHOICES.filter((c) => c.for.includes(kind));
  const listed = choices.some((c) => c.stack === value);
  const [custom, setCustom] = useState(listed ? '' : value);
  const [isCustom, setIsCustom] = useState(!listed);
  const invalid = isCustom && custom.trim() !== '' && !isSettingValue(token, custom);
  return (
    <div className="setting">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={isCustom ? 'custom' : value} onChange={(e) => {
        if (e.target.value === 'custom') { setIsCustom(true); setCustom(value); return; }
        setIsCustom(false);
        onChange(token, e.target.value);
      }}>
        {choices.map((c) => <option key={c.stack} value={c.stack}>{c.label}</option>)}
        <option value="custom">Custom font stack…</option>
      </select>
      {isCustom && (
        <input
          type="text"
          aria-label={`${label}, custom font stack`}
          aria-invalid={invalid}
          spellCheck={false}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={() => { if (!invalid && custom.trim()) onChange(token, custom.trim()); }}
        />
      )}
      {invalid && <p className="field-problem">Family names separated by commas, such as <code>"Inter", system-ui, sans-serif</code>.</p>}
    </div>
  );
}

function RangeField({ label, token, theme, min, max, step, onChange }: { label: string; token: SettingToken; theme: Theme; min: number; max: number; step: number; onChange: (t: SettingToken, v: string) => void }) {
  const id = useId();
  const value = pxOf(tokenValue(theme, 'light', token) ?? '');
  return (
    <div className="setting">
      <label htmlFor={id}>{label} <output htmlFor={id}>{value}px</output></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(token, `${e.target.value}px`)} />
    </div>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  const name = useId();
  return (
    <div className="setting">
      <span id={`${name}-l`} className="setting-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={`${name}-l`}>
        {options.map(([v, text]) => (
          <label key={v} className={`segment${value === v ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            {text}
          </label>
        ))}
      </div>
    </div>
  );
}

