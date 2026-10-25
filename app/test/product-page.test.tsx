import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { main, openApp, section } from './helpers';

const card = (title: string) => within(section(/^Domains/)).getByText(title).closest('article') as HTMLElement;
const bars = (element: HTMLElement) =>
  [...element.querySelectorAll('.bar')].map((bar) => [...bar.children].map((c) => c.textContent).filter(Boolean).join(' '));

describe('product page', () => {
  it('LA-TRC-T82 The product page shows each domain as a card with its coverage bars and counts', async () => {
    await openApp('/DM');
    expect(await screen.findByRole('heading', { level: 1, name: 'Demo shop' })).toBeInTheDocument();
    const cards = within(section(/^Domains/)).getAllByRole('article');
    expect(cards).toHaveLength(2);

    const shop = card('Shopping');
    expect(within(shop).getByRole('link', { name: /DM-SHOP\s*Shopping/ })).toHaveAttribute('href', '/DM-SHOP');
    expect(within(shop).getByText('UC requirements')).toBeInTheDocument();
    expect(within(shop).getByText('Domain rules')).toBeInTheDocument();
    expect(within(shop).getByRole('img', { name: 'designed: 2 of 2' })).toBeInTheDocument();
    expect(within(shop).getByRole('img', { name: 'proved: 1 of 2' })).toBeInTheDocument();
    expect(within(shop).getByRole('img', { name: 'proved: 0 of 1' })).toBeInTheDocument();
    // A full bar is drawn full; a partial one is drawn to its share.
    const fills = [...shop.querySelectorAll<HTMLElement>('.bar-fill')].map((f) => [f.style.width, f.classList.contains('full')]);
    expect(fills).toEqual([
      ['100%', true], ['100%', true], ['0%', false], ['0%', false],
      ['100%', true], ['50%', false], ['50%', false], ['0%', false],
    ]);
  });

  it('LA-TRC-T83 Coverage shows designed, built and proved on the product and domain pages', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(bars(card('Shopping'))).toEqual([
      'designed 1/1', 'built 1/1', 'proved 0/1', 'planned 0/1',
      'designed 2/2', 'built 1/2', 'proved 1/2', 'planned 0/2',
    ]);
    // A count of zero is drawn as a bar like any other.
    const pay = card('Paying');
    expect(bars(pay)).toEqual([
      'designed 0/0', 'built 0/0', 'proved 0/0', 'planned 0/0',
      'designed 0/1', 'built 0/1', 'proved 0/1', 'planned 0/1',
    ]);
    expect(within(pay).getAllByRole('img', { name: /^built: 0 of/ })).toHaveLength(2);

    // The same counts on the domain page.
    await openApp('/DM-PAY');
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    expect(bars(section('Coverage'))).toEqual(bars(pay));
  });

  it('LA-TRC-T84 The product page lists its open questions with owners, and the problems in its records', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const questions = section(/^Open questions/);
    const items = within(questions).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/DM-Q01.*Should the shop ship abroad\?.*owner Owner.*about DM/),
      expect.stringMatching(/DM-SHOP-Q01.*What happens to a basket overnight\?.*owner Ana.*about DM-SHOP-A1/),
    ]);

    const problems = within(section(/^Problems in this product/)).getAllByRole('listitem');
    // Only this product's problems, errors first.
    expect(problems.map((li) => li.querySelector('.severity')?.textContent)).toEqual(['error', 'warning', 'warning', 'warning']);
    expect(problems[0]).toHaveTextContent('DM-SHOP-T01');
    expect(main()).not.toHaveTextContent('NF-NOTE links to NF-NOTE-X9');
  });

  it('LA-TRC-T85 The product page shows the latest fitness and its history apart from the evidence, or says how to add one', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const fitness = section('Fitness');
    const latest = fitness.querySelector('.fitness-latest') as HTMLElement;
    expect(within(latest).getByLabelText('Score 4 of 5')).toBeInTheDocument();
    expect(within(latest).getByText('2026-10-20')).toBeInTheDocument();
    expect(within(latest).getByText('two clicks').tagName).toBe('EM');
    expect(within(latest).getByRole('link', { name: 'DM-FIT02' })).toHaveAttribute('href', '/DM-FIT02');

    const history = within(fitness).getByRole('list');
    expect(within(history).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringMatching(/2026-10-20.*4\/5.*DM-FIT02.*Finding things is quick/),
      expect.stringMatching(/2026-09-01.*2\/5.*DM-FIT01.*Early days/),
    ]);

    // The evidence is its own section, with counts the page can make, and never a score.
    const evidence = section('Evidence');
    expect(fitness.contains(evidence)).toBe(false);
    expect(evidence).toHaveTextContent('they are not the score');
    const value = (name: string) => within(evidence).getByText(name).nextElementSibling?.textContent;
    expect(value('Designed')).toBe('3 of 4 obligations');
    expect(value('Built')).toBe('2 of 4 obligations');
    expect(value('Proved')).toBe('1 of 4 obligations');
    expect(value('Open questions')).toBe('2');
    expect(value('Errors')).toBe('1');
    expect(value('Warnings')).toBe('3');
    expect(within(evidence).queryByLabelText(/^Score/)).toBeNull();

    // A product with no fitness record says so, and links to the format section.
    await openApp('/NF');
    await screen.findByRole('heading', { level: 1, name: 'Notebook' });
    const none = section('Fitness');
    expect(none).toHaveTextContent('No fitness recorded yet.');
    expect(within(none).getByRole('link', { name: /section 7: Fitness/ })).toHaveAttribute('href', '/format#7-fitness');
    expect(within(section('Evidence')).getByText('Built').nextElementSibling).toHaveTextContent('0 of 0 obligations');
  });

  it('LA-TRC-T85 The format page shows the fitness section the product page links to', async () => {
    await openApp('/format#7-fitness');
    const heading = await screen.findByRole('heading', { name: '7. Fitness' });
    expect(heading).toHaveAttribute('id', '7-fitness');
  });
});
