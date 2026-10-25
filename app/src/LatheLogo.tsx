import { useId } from 'react';

// Lathe's logo: a chuck gripping the same chuck, smaller (brand/recursive.svg). It takes the page's
// --steel and --spark colors, so it follows light and dark mode.
export function LatheLogo({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  const cut = `${id}-cut`;
  const chuck = `${id}-chuck`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="lathe-logo">
      <defs>
        <mask id={cut}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="32" cy="32" r="13.5" fill="#000" />
          {[0, 120, 240].map((angle) => (
            <rect key={angle} x="27.5" y="0" width="9" height="20" fill="#000" transform={`rotate(${angle} 32 32)`} />
          ))}
        </mask>
        <g id={chuck}>
          <circle cx="32" cy="32" r="29" style={{ fill: 'var(--steel)' }} mask={`url(#${cut})`} />
          <g style={{ fill: 'var(--spark)' }}>
            {[0, 120, 240].map((angle) => (
              <path key={angle} d="M29.6 20.9V14H28.6V8H35.4V14H34.4V20.9Z" transform={`rotate(${angle} 32 32)`} />
            ))}
          </g>
        </g>
      </defs>
      <use href={`#${chuck}`} />
      <use href={`#${chuck}`} transform="translate(32 32) rotate(60) scale(0.38) translate(-32 -32)" />
    </svg>
  );
}
