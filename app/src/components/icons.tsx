// Tabler-style line icons, drawn inline (24 x 24, 2 px stroke, round caps). No icon font.

const PATHS: Record<string, string[]> = {
  specs: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z', 'M9 13h6', 'M9 17h6'],
  checks: ['M9 11l3 3l8-8', 'M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9'],
  graph: ['M6 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M18 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M12 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M7.5 7.5l3.5 8.5', 'M16.5 7.5l-3.5 8.5', 'M8 6h8'],
  format: ['M4 6h16', 'M4 12h10', 'M4 18h14', 'M18 10l3 2l-3 2'],
  search: ['M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M21 21l-6-6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  'chevron-right': ['M9 6l6 6l-6 6'],
  'chevron-down': ['M6 9l6 6l6-6'],
  'chevron-left': ['M15 6l-6 6l6 6'],
  pages: ['M12 4l-8 4l8 4l8-4l-8-4', 'M4 12l8 4l8-4', 'M4 16l8 4l8-4'],
  info: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 8h.01', 'M11 12h1v4h1'],
  'sidebar-left': ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M9 4v16'],
  'sidebar-right': ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M15 4v16'],
  wiki: ['M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6v13', 'M12 6v13', 'M21 6v13'],
  split: ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M12 4v16'],
  maximize: ['M4 8V6a2 2 0 0 1 2-2h2', 'M4 16v2a2 2 0 0 0 2 2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M16 20h2a2 2 0 0 0 2-2v-2'],
  minimize: ['M15 19v-2a2 2 0 0 1 2-2h2', 'M15 5v2a2 2 0 0 0 2 2h2', 'M5 15h2a2 2 0 0 1 2 2v2', 'M5 9h2a2 2 0 0 0 2-2V5'],
  keyboard: ['M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z', 'M6 10v.01', 'M10 10v.01', 'M14 10v.01', 'M18 10v.01', 'M6 14v.01', 'M18 14v.01', 'M10 14h4'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  plus: ['M12 5v14', 'M5 12h14'],
  // The side bar's views (brief 64): Details is `info`; Outline and History.
  outline: ['M9 6h11', 'M12 12h8', 'M15 18h5', 'M5 6v.01', 'M8 12v.01', 'M11 18v.01'],
  history: ['M12 8v4l2 2', 'M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5'],
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, title }: { name: IconName | string; size?: number; title?: string }) {
  const paths = PATHS[name] ?? [];
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
