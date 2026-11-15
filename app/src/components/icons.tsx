// Tabler-style line icons, drawn inline (24 x 24, 2 px stroke, round caps). No icon font.

const PATHS: Record<string, string[]> = {
  checks: ['M9 11l3 3l8-8', 'M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9'],
  graph: ['M6 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M18 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M12 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M7.5 7.5l3.5 8.5', 'M16.5 7.5l-3.5 8.5', 'M8 6h8'],
  search: ['M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M21 21l-6-6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  filter: ['M4 4h16v2.172a2 2 0 0 1-.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48-4.928a2 2 0 0 1-.52-1.345v-2.227z'],
  dots: ['M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0'],
  'chevron-right': ['M9 6l6 6l-6 6'],
  'chevron-down': ['M6 9l6 6l6-6'],
  // The walk's bar on a phone (views/StageChrome.tsx): Previous and Next, then Out to the parent and In to the first child.
  'chevron-left': ['M15 6l-6 6l6 6'],
  'corner-left-up': ['M18 18h-6a3 3 0 0 1-3-3V5', 'M5 9l4-4l4 4'],
  'corner-right-down': ['M6 6h6a3 3 0 0 1 3 3v10', 'M11 15l4 4l4-4'],
  pages: ['M12 4l-8 4l8 4l8-4l-8-4', 'M4 12l8 4l8-4', 'M4 16l8 4l8-4'],
  info: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 8h.01', 'M11 12h1v4h1'],
  'sidebar-left': ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M9 4v16'],
  'sidebar-right': ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M15 4v16'],
  // The Trace view: a chain of three columns, left to right.
  trace: ['M3 9h4v6H3z', 'M10 9h4v6h-4z', 'M17 9h4v6h-4z', 'M7 12h3', 'M14 12h3'],
  wiki: ['M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0','M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6v13', 'M12 6v13', 'M21 6v13'],
  // A stage's Frame (the focus) and its camera's Fit (the whole map).
  focus: ['M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0', 'M12 3v3', 'M12 18v3', 'M3 12h3', 'M18 12h3'],
  maximize: ['M4 8V6a2 2 0 0 1 2-2h2', 'M4 16v2a2 2 0 0 0 2 2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M16 20h2a2 2 0 0 0 2-2v-2'],
  // The ERD's Tidy up: the map laid out afresh, its boxes in a neat grid (Tabler's layout-grid).
  tidy: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  // Every stage's zoom buttons, and a record's Add.
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  // The Changes tool.
  history: ['M12 8v4l2 2', 'M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5'],
  // A record's Edit and Remove actions (Add is `plus`).
  edit: ['M7 7h-1a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1', 'M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97l-8.415 8.385v3h3l8.385-8.415z', 'M16 5l3 3'],
  // The nav's open questions.
  help: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 17v.01', 'M12 13.5a1.5 1.5 0 0 1 1-1.5a2.6 2.6 0 1 0-3-4'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12', 'M9 7v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3'],
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
