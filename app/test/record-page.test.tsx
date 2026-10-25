import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/specs/Markdown';
import { main, openApp, openSideBar, section } from './helpers';

// The record page's wiki shows the body, its Traceability, children and problems; the side bar's
// Details, in the Wiki view, adds only what the page leaves out: the spec file, the raw header
// fields and the raw links (brief 64).
const side = () => main().querySelector('aside.record-side') as HTMLElement;
/** A raw header field's value in the side bar. */
const field = (name: string) => within(side()).getByText(name, { selector: 'dt code' }).closest('div')?.querySelector('dd')?.textContent;

/** The Traceability groups of the wiki, as label -> linked record addresses. */
function traceGroups() {
  const trace = section(/^Traceability/);
  return Object.fromEntries([...trace.querySelectorAll('h3')].map((h) => [
    h.firstChild?.textContent,
    [...h.closest('section')!.querySelectorAll('a.row-link')].map((a) => a.getAttribute('href')),
  ]));
}

/** The raw links in the side bar under "Links out" or "Links in", as "relation ID". */
const rawLinks = (heading: 'Links out' | 'Links in') => {
  const h = within(side()).getByRole('heading', { name: new RegExp(`^${heading}`) });
  return [...h.closest('section')!.querySelectorAll('li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
};

describe('record page', () => {
  it('LA-BRW-T10 The record page shows the ID, kind, title, fields, rendered body, parent and children', async () => {
    openSideBar();
    await openApp('/DM-SHOP-UC01');
    expect(await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' })).toBeInTheDocument();
    expect(main().querySelector('.record-id')).toHaveTextContent('DM-SHOP-UC01');
    expect(main().querySelector('.pane-title .eyebrow')).toHaveTextContent('Use case');
    expect(within(main()).getByText('A shopper adds an item.').closest('.markdown')).not.toBeNull();
    // The side bar: the file's header as written, and the spec file.
    expect(field('kind')).toBe('use_case');
    expect(field('actor')).toBe('Shopper');
    expect(within(side()).getByText('specs/dm/DM-SHOP-UC01.md')).toBeInTheDocument();
    expect(within(side()).getByText('parent', { selector: 'dt code' }).closest('div')!.querySelector('a')).toHaveAttribute('href', '/DM-SHOP');

    // The children are the wiki's.
    const children = within(main()).getByRole('heading', { name: /^UC requirements/ });
    expect(children).toHaveTextContent(/^UC requirements\s*2$/);
    const items = [...children.closest('section')!.querySelectorAll('a.row-link')];
    expect(items.map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01-R01', '/DM-SHOP-UC01-R02']);
    expect(within(side()).queryByRole('heading', { name: /^UC requirements/ })).toBeNull();

    // Markdown in a body is rendered.
    await openApp('/DM');
    expect((await screen.findByText('component tests')).tagName).toBe('STRONG');
  });

  it('LA-BRW-T11 The record page shows links out and links in, grouped and named by their labels, each clickable', async () => {
    openSideBar();
    await openApp('/DM-SHOP-UC01-R01');
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    // Grouped by label in the wiki's Traceability.
    expect(traceGroups()).toEqual({
      'Designed by': ['/DM-SHOP-C01'],
      'Proved by': ['/DM-SHOP-T01'],
      'Carried out in': ['/DM-SHOP-E01', '/DM-SHOP-F01', '/DM-SHOP-V01'],
    });
    // Raw in the side bar, as the files write them.
    expect(within(side()).getByText('This record links to nothing.')).toBeInTheDocument();
    expect(rawLinks('Links in')).toEqual(expect.arrayContaining(['satisfies DM-SHOP-C01', 'proves DM-SHOP-T01']));

    // Follow an incoming link to the component, then see its outgoing links.
    const user = userEvent.setup();
    const trace = section(/^Traceability/);
    await user.click(within(trace).getByRole('link', { name: /DM-SHOP-C01/ }));
    expect(window.location.pathname).toBe('/DM-SHOP-C01');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Basket service');
    expect(traceGroups()).toMatchObject({
      Satisfies: ['/DM-SHOP-DR01', '/DM-SHOP-UC01-R01', '/DM-SHOP-UC01-R02'],
      Implements: ['/DM-SHOP-E01'],
    });
    expect(rawLinks('Links out')).toEqual(['satisfies DM-SHOP-UC01-R01', 'satisfies DM-SHOP-UC01-R02', 'satisfies DM-SHOP-DR01', 'implements DM-SHOP-E01']);
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
