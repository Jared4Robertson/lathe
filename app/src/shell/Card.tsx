import type { MouseEvent, ReactNode } from 'react';
import { Link } from '../router';

// A card has one primary action, taken by clicking anywhere on it (LA-PAT-APP-UX-R14). This is the one way to draw a
// card: its primary action is required, an address (`href`) to open or an action (`onActivate`) to take, so a card
// without one does not compile. The card's title is that real link or button, and the title's ::after stretches over
// the whole card, so the card has one tab stop and one accessible name; any other link or button in it sits above the
// stretched title and does what it says. The classes card, card-* and the card's look belong to this file alone.

type Primary =
  | {
      /** The address the card opens: its title is a real link, so Cmd/Ctrl-click opens a new tab. */
      href: string;
      /** What a plain click does instead of the app's navigation, for a view that moves its own way (Cmd/Ctrl-click still opens a tab). */
      onFollow?: () => void;
      /** The card for the page the Reader is on (aria-current). */
      current?: boolean;
      onActivate?: never;
      pressed?: never;
    }
  | {
      /** What the card does: its title is a button. */
      onActivate: () => void;
      href?: never;
      onFollow?: never;
      current?: never;
      /** For a card that is one choice among several: whether it is the one chosen (drawn as current). */
      pressed?: boolean;
    };

export type CardProps = Primary & {
  /** The title: what the link or button shows. */
  title: ReactNode;
  /** The accessible name, when the title alone does not say what the action does (such as "Use Graphite"). */
  label?: string;
  /** A tooltip on the title, such as a long title in full. */
  hint?: string;
  /** Data attributes on the title, for a view that listens on its cards from above (such as `data-trace-id`). */
  data?: { [attribute: `data-${string}`]: string };
  /** Drawn above the title and hidden from assistive technology, such as a preview. */
  media?: ReactNode;
  /** A tile in a CardGrid (the default), a compact one in a narrow column, or a bar that floats over a canvas. */
  look?: 'tile' | 'compact' | 'bar';
  /** A left edge in the stage's color, for a card that belongs to one stage. */
  accent?: boolean;
  /** A list item in a CardGrid (the default), or a box of its own. */
  as?: 'li' | 'div';
  /** A card that appears in answer to the Reader (such as a tapped node's) is announced. */
  role?: 'status';
  /** What the card holds besides its title; any link or button here stays clickable on its own. */
  children?: ReactNode;
};

export function Card({ href, onFollow, current, onActivate, pressed, title, label, hint, data, media, look = 'tile', accent = false, as: Box = 'li', role, children }: CardProps) {
  const className = ['card', look === 'bar' ? 'card-bar' : look === 'compact' ? 'card-compact' : '', accent ? 'card-accent' : '', pressed || current ? 'is-current' : ''].filter(Boolean).join(' ');
  const follow = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onFollow || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onFollow();
  };
  return (
    <Box className={className} role={role}>
      {media && <div className="card-media" aria-hidden="true">{media}</div>}
      {href !== undefined
        ? <Link to={href} className="card-title" aria-label={label} title={hint} aria-current={current ? 'page' : undefined} onClick={follow} {...data}>{title}</Link>
        : <button type="button" className="card-title" aria-label={label} title={hint} aria-pressed={pressed} onClick={onActivate} {...data}>{title}</button>}
      {children}
    </Box>
  );
}

/** Cards side by side, as many to a row as fit (or one to a row, stacked), as a list. */
export function CardGrid({ stack = false, label, children }: { stack?: boolean; label?: string; children: ReactNode }) {
  return <ul className={stack ? 'card-grid card-stack' : 'card-grid'} aria-label={label}>{children}</ul>;
}
