import { useState, type CSSProperties } from 'react';
import { navigate } from '../router';
import { useAnnounce, useCommand } from '../shell/commands';
import { shownMode } from './apply';
import { themeVars } from './css';
import { QuickPick } from './QuickPick';
import { useThemes } from './ThemeProvider';
import { MODE_CHOICES, MODE_LABELS, type ModeChoice, type Theme } from './theme';
import { panelHref } from '../views/overlays';
import { turnScrollToZoomOnOrOff } from '../platform/appearance/commands/handlers.generated';
import { useScrollToZoom } from '../platform/appearance/use-scroll-to-zoom';

/** A palette, drawn like the shared icons (app/src/components/icons.tsx): 24 x 24 lines, 2 px stroke. */
export function PaletteIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 21a9 9 0 0 1 0-18c4.97 0 9 3.58 9 8a4 4 0 0 1-4 4h-2.5a1.5 1.5 0 0 0-1 2.6a1.5 1.5 0 0 1-1 2.4z" />
      <path d="M7.5 10.5h.01" /><path d="M12 7.5h.01" /><path d="M16.5 10.5h.01" />
    </svg>
  );
}

/** A theme's colors in a small chip: its page, a line of text and its accent, in the mode it would show. */
export function ThemeChip({ theme, mode }: { theme: Theme; mode: 'light' | 'dark' }) {
  return (
    <span className="theme-chip" style={themeVars(theme, mode) as CSSProperties} aria-hidden="true">
      <span className="theme-chip-ink" />
      <span className="theme-chip-accent" />
    </span>
  );
}

/**
 * The theme commands: "Color theme" opens a quick pick that shows each theme as it is arrowed to,
 * keeping it on Enter and putting back the one before on Escape; "Light, dark or system" does the
 * same for the mode; a command opens Appearance over the stage; and one turns Scroll to zoom on or off.
 */
export function ThemeCommands() {
  const { themes, active, mode, choose, setMode, preview } = useThemes();
  const announce = useAnnounce();
  const [open, setOpen] = useState<'theme' | 'mode' | null>(null);

  useCommand('chooseTheme', () => setOpen('theme'));
  useCommand('chooseColorMode', () => setOpen('mode'));
  useCommand('openAppearance', () => navigate(panelHref('appearance')));
  const scrollToZoom = useScrollToZoom();
  useCommand('toggleScrollToZoom', () => {
    turnScrollToZoomOnOrOff({ on: !scrollToZoom });
    announce(scrollToZoom ? 'Scroll to zoom off: scroll pans' : 'Scroll to zoom on: scroll zooms');
  });

  const close = () => { preview(null); setOpen(null); };
  const shows = shownMode(mode);

  if (open === 'theme') {
    return (
      <QuickPick
        label="Color theme"
        placeholder="Select a color theme"
        current={active.id}
        items={themes.map((t) => ({ id: t.id, text: t.name, detail: t.builtIn ? 'Built in' : 'Yours', icon: <ThemeChip theme={t} mode={shows} /> }))}
        onActive={(id) => { const theme = themes.find((t) => t.id === id); if (theme) preview({ theme }); }}
        onPick={(id) => { choose(id); setOpen(null); announce(`Color theme: ${themes.find((t) => t.id === id)?.name ?? id}`); }}
        onCancel={close}
      />
    );
  }
  if (open === 'mode') {
    return (
      <QuickPick
        label="Light, dark or system"
        placeholder="Select light, dark or system"
        current={mode}
        items={MODE_CHOICES.map((m) => ({ id: m, text: MODE_LABELS[m], detail: m === 'system' ? `Follows the system, now ${shownMode('system')}` : undefined }))}
        onActive={(id) => preview({ mode: id as ModeChoice })}
        onPick={(id) => { setMode(id as ModeChoice); setOpen(null); announce(`Mode: ${MODE_LABELS[id as ModeChoice]}`); }}
        onCancel={close}
      />
    );
  }
  return null;
}
