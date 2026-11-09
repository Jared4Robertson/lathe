import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableScroll } from '../src/components/TableScroll';

// LA-PAT-APP-UX-R10: a table that scrolls sideways is a named stop on the Tab order, and only while it scrolls.

let resized: () => void;

function drawn(width: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(width);
}

const table = <TableScroll><table><caption>The columns of use_case</caption><tbody><tr><td>a</td></tr></tbody></table></TableScroll>;

describe('LA-V61-R41-T03 TableScroll', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { resized = cb; } observe() {} disconnect() {} });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('names the box after its caption and adds it to the Tab order while the table overflows', () => {
    drawn(420);
    render(table);
    const region = screen.getByRole('region', { name: 'The columns of use_case (scrolls)' });
    expect(region.tabIndex).toBe(0);
  });

  it('every table that scrolls has a caption to name its box, read from the source so no page finds out by scrolling', () => {
    const src = path.join(__dirname, '../src');
    const sites = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.tsx') && !f.endsWith('TableScroll.tsx')).flatMap((f) => {
      const text = readFileSync(path.join(src, f), 'utf8');
      return [...text.matchAll(/<TableScroll\b[^>]*>([\s\S]*?)<\/TableScroll>/g)].map((m) => ({ f, captioned: /^\s*<table\b[^>]*>\s*<caption\b/.test(m[1]) }));
    });
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.filter((s) => !s.captioned).map((s) => s.f)).toEqual([]);
  });

  it('adds no stop while the table fits', () => {
    drawn(300);
    const { container } = render(table);
    const box = container.querySelector('.table-scroll')!;
    expect(box.hasAttribute('tabindex')).toBe(false);
    expect(box.hasAttribute('role')).toBe(false);
  });

  it('follows the width: a box that starts to overflow becomes a stop, and stops being one when it fits again', () => {
    drawn(300);
    const { container } = render(table);
    const box = container.querySelector('.table-scroll')!;
    drawn(420);
    act(() => resized());
    expect(box.getAttribute('tabindex')).toBe('0');
    drawn(300);
    act(() => resized());
    expect(box.hasAttribute('tabindex')).toBe(false);
  });
});
