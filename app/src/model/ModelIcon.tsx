// The Model view's icon: two boxes joined by a line, drawn like the shared line icons
// (app/src/components/icons.tsx: 24 x 24, 2 px stroke, round caps).

const PATHS = ['M3 4h7v6H3z', 'M14 14h7v6h-7z', 'M6.5 10v7h7.5', 'M17.5 14V7H10'];

export function ModelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
