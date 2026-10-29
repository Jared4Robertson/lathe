import { useRef, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { BottomSheet } from '../shell/BottomSheet';
import { Tooltip } from '../shell/Tooltip';
import { useOverlayFocus } from './overlays';

export interface ToolPanelProps {
  /** Its name, for its heading and for screen readers: "Checks", "Appearance". */
  label: string;
  /** What heads it, after the label: counts, actions. */
  head?: ReactNode;
  /** Its class, which sets its place and width: `checks-panel`, `appearance-popover`, `theme-panel`. */
  className: string;
  /** On a phone: a bottom sheet. */
  sheet: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A tool over the stage (LA-PAT-APP-UX-R20): a frosted panel floating at the left of the open space, right of
 * the nav, which the open space leaves room for (`data-floating`), with its name and a close button;
 * on a phone, a bottom sheet. It takes focus as it opens and gives it back as it closes.
 */
export function ToolPanelFrame({ label, head, className, sheet, onClose, children }: ToolPanelProps) {
  const box = useRef<HTMLElement>(null);
  useOverlayFocus(box);
  const close = (
    <Tooltip label={`Close ${label}`} placement="left">
      <Button variant="icon" label={`Close ${label}`} className="tool-panel-close" onClick={onClose}><Icon name="x" size={16} /></Button>
    </Tooltip>
  );
  const top = (
    <div className="tool-panel-head">
      <h2 className="tool-panel-title">{label}</h2>
      {head}
      {close}
    </div>
  );
  if (sheet) {
    return (
      <BottomSheet label={label} className={`tool-sheet ${className}`} onClose={onClose}>
        <section ref={box} className="tool-panel is-sheet" aria-label={label} tabIndex={-1}>
          {top}
          <div className="tool-panel-scroll">{children}</div>
        </section>
      </BottomSheet>
    );
  }
  return (
    <section ref={box} className={`tool-panel ${className}`} aria-label={label} tabIndex={-1} data-floating="left">
      {top}
      <div className="tool-panel-scroll">{children}</div>
    </section>
  );
}
