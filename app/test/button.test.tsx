import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button, buttonClass } from '../src/components/Button';

const CSS = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');

describe('LA-STD-PRINCIPLES-R02-T02 One Button for every action (LA-PAT-APP-UX-R09)', () => {
  it('The Button component draws ghost, primary and icon buttons, and links as buttons', () => {
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Expand all</Button>
        <Button variant="primary" type="submit">Open</Button>
        <Button variant="icon" label="Close the pane">×</Button>
        <Button icon="plus">Add a filter</Button>
        <Button danger>Delete</Button>
        <Button href="/DM">Open the product overview</Button>
      </>,
    );
    const ghost = screen.getByRole('button', { name: 'Expand all' });
    expect(ghost.tagName).toBe('BUTTON');
    expect(ghost.getAttribute('type')).toBe('button');
    expect(ghost.className).toBe('button button-ghost');
    ghost.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    const primary = screen.getByRole('button', { name: 'Open' });
    expect(primary.getAttribute('type')).toBe('submit');
    expect(primary.className).toBe('button button-primary');

    const icon = screen.getByRole('button', { name: 'Close the pane' });
    expect(icon.className).toBe('icon-button');

    expect(screen.getByRole('button', { name: 'Add a filter' }).querySelector('svg.icon')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Delete' }).className).toBe('button button-ghost button-danger');

    const link = screen.getByRole('link', { name: 'Open the product overview' });
    expect(link.getAttribute('href')).toBe('/DM');
    expect(link.className).toBe('button button-ghost');
    expect(buttonClass('primary', { className: 'file-button' })).toBe('button button-primary file-button');

    // One look, styled once: the ghost hover tint, the primary fill, and a 44 px target on a coarse pointer.
    expect(CSS).toMatch(/\.button:not\(:disabled\):hover\s*\{[^}]*var\(--hover-bg\)/);
    expect(CSS).toMatch(/\.button-primary\s*\{[^}]*background:\s*var\(--steel\)/);
    expect(CSS).toMatch(/@media \(pointer: coarse\)[\s\S]*:is\([^)]*\.button,[\s\S]*?\)\s*\{\s*min-width:\s*var\(--touch-target\);\s*min-height:\s*var\(--touch-target\)/);
  });
});
