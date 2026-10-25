import type { KeyboardEvent, PointerEvent } from 'react';

// A vertical handle that resizes what sits beside it, as in VS Code: drag it, or focus it and use
// the arrow keys (Shift for bigger steps), Home and End for the limits, and double-click to reset.
// The host knows its own geometry, so it turns a pointer position into a value; this component only
// clamps, steps and reports. Every resizable divider in the app uses it, so they all behave alike.

export interface ResizeHandleProps {
  /** What it resizes, for screen readers: "Resize the navigation". */
  label: string;
  value: number;
  min: number;
  max: number;
  /** The arrow-key step, and the step with Shift. */
  step: number;
  bigStep: number;
  /** The value for a pointer at this horizontal position, before clamping. */
  valueAt: (clientX: number) => number;
  onChange: (value: number) => void;
  /** Double-click: back to the default. */
  onReset: () => void;
  /** Dragged this far below the minimum: the host may collapse what it resizes instead. */
  collapseBelow?: number;
  onCollapse?: () => void;
  /** Where the panel it sizes sits: before the handle (the default; Right arrow grows it) or after it (Left arrow grows it). */
  side?: 'before' | 'after';
  className?: string;
}

export function ResizeHandle({ label, value, min, max, step, bigStep, valueAt, onChange, onReset, collapseBelow, onCollapse, side = 'before', className = '' }: ResizeHandleProps) {
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('is-dragging');
    const move = (ev: globalThis.PointerEvent) => {
      const raw = valueAt(ev.clientX);
      if (onCollapse && collapseBelow !== undefined && raw < collapseBelow) { up(); onCollapse(); return; }
      onChange(clamp(raw));
    };
    const up = () => {
      el.classList.remove('is-dragging');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = (e.shiftKey ? bigStep : step) * (side === 'after' ? -1 : 1);
    const next = e.key === 'ArrowLeft' ? value - by : e.key === 'ArrowRight' ? value + by : e.key === 'Home' ? min : e.key === 'End' ? max : null;
    if (next === null) return;
    e.preventDefault();
    onChange(clamp(next));
  };

  return (
    <div
      className={`resize-handle ${className}`.trim()}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
    />
  );
}
