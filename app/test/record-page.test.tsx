import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/specs/Markdown';
import { main, openApp, section } from './helpers';

const side = () => main().querySelector('aside.record-side') as HTMLElement;
// A required field's label is a link to the kind's page, so the label may sit in a link inside the dt.
const field = (name: string) => within(side()).getByText(name, { selector: 'dt, dt a' }).closest('div')?.querySelector('dd')?.textContent;

/** The link groups under a "Links out" or "Links in" heading, as relation -> linked IDs. */
function linkGroups(heading: 'Links out' | 'Links in') {
  const h = within(side()).getByRole('heading', { name: heading });
  const list = h.nextElementSibling as HTMLElement;
  if (list.tagName !== 'DL') return {};
  return Object.fromEntries([...list.children].map((group) => [
    group.querySelector('dt')?.textContent,
    [...group.querySelectorAll('dd a')].map((a) => a.getAttribute('href')),
  ]));
}

describe('record page', () => {
  it('LA-BRW-T10 The record page shows the ID, kind, title, fields, rendered body, parent and children', async () => {
    await openApp('/DM-SHOP-UC01');
    expect(await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' })).toBeInTheDocument();
    expect(main().querySelector('.record-id')).toHaveTextContent('DM-SHOP-UC01');
    expect(field('Kind')).toBe('Use case');
    expect(field('actor')).toBe('Shopper');
    expect(field('Spec file')).toBe('specs/dm/DM-SHOP-UC01.md');
    expect(within(main()).getByText('A shopper adds an item.').closest('.markdown')).not.toBeNull();

    const parent = within(side()).getByRole('heading', { name: 'Parent' }).nextElementSibling as HTMLElement;
    expect(parent).toHaveAttribute('href', '/DM-SHOP');
    const children = within(side()).getByRole('heading', { name: /^UC requirements/ });
    expect(children).toHaveTextContent('UC requirements 2');
    const items = within(children.nextElementSibling as HTMLElement).getAllByRole('link');
    expect(items.map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01-R01', '/DM-SHOP-UC01-R02']);

    // Markdown in a body is rendered.
    await openApp('/DM');
    expect((await screen.findByText('component tests')).tagName).toBe('STRONG');
  });

  it('LA-BRW-T11 The record page shows links out and links in, grouped and named by their labels, each clickable', async () => {
    await openApp('/DM-SHOP-UC01-R01');
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    expect(linkGroups('Links out')).toEqual({});
    expect(within(side()).getByText('This record links to nothing.')).toBeInTheDocument();
    expect(linkGroups('Links in')).toEqual({
      'Carried out in': ['/DM-SHOP-E01', '/DM-SHOP-F01', '/DM-SHOP-V01'],
      'Designed by': ['/DM-SHOP-C01'],
      'Proved by': ['/DM-SHOP-T01'],
    });

    // Follow an incoming link to the component, then see its outgoing links.
    const user = userEvent.setup();
    await user.click(within(side()).getByRole('link', { name: /DM-SHOP-C01/ }));
    expect(window.location.pathname).toBe('/DM-SHOP-C01');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Basket service');
    expect(linkGroups('Links out')).toEqual({
      Implements: ['/DM-SHOP-E01'],
      Satisfies: ['/DM-SHOP-DR01', '/DM-SHOP-UC01-R01', '/DM-SHOP-UC01-R02'],
    });
    expect(within(side()).getByText('Nothing links to this record.')).toBeInTheDocument();
  });

  it('LA-BRW-T12 A record body is sanitized before it is shown', async () => {
    await openApp('/DM-SHOP-C01');
    await screen.findByRole('heading', { level: 1, name: 'Basket service' });
    const body = main().querySelector('.markdown') as HTMLElement;
    expect(body).toHaveTextContent('Holds baskets.');
    expect(body.querySelector('script')).toBeNull();
    expect(body.querySelector('[onerror]')).toBeNull();
    expect(within(body).getByText('bad link')).not.toHaveAttribute('href', 'javascript:alert(1)');
    expect((window as { __pwned?: boolean }).__pwned).toBeUndefined();

    const html = renderMarkdown('<iframe src="https://example.com"></iframe><p onclick="x()">hi</p>');
    expect(html).not.toContain('iframe');
    expect(html).not.toContain('onclick');
    expect(html).toContain('<p>hi</p>');
  });

  it('LA-BRW-T13 The record page lists every problem about the record', async () => {
    await openApp('/DM-SHOP-T01');
    await screen.findByRole('heading', { level: 1, name: 'Adding an item shows it' });
    const problems = within(section(/^Problems/)).getAllByRole('listitem');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toHaveTextContent(/error.*Test DM-SHOP-T01 is run by test\/basket.test.ts, which does not exist\..*test-file-missing/);
    expect(within(main()).getByText('1 error')).toBeInTheDocument();

    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(within(section(/^Problems/)).getByText('No problems.')).toBeInTheDocument();
  });
});
