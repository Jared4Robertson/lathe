import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { main, openApp, section } from './helpers';

const card = (title: string) => within(section(/^Domains/)).getByText(title).closest('article') as HTMLElement;
const bars = (element: HTMLElement) =>
  [...element.querySelectorAll('.bar')].map((bar) => [...bar.children].map((c) => c.textContent).filter(Boolean).join(' '));

describe('product page', () => {
  it('LA-BRW-T03 The product page shows each domain as a card with its coverage bars and counts', async () => {
    await openApp('/specs/DM');
    expect(await screen.findByRole('heading', { level: 1, name: 'Demo shop' })).toBeInTheDocument();
    const cards = within(section(/^Domains/)).getAllByRole('article');
    expect(cards).toHaveLength(2);

    const shop = card('Shopping');
    expect(within(shop).getByRole('link', { name: /DM-SHOP\s*Shopping/ })).toHaveAttribute('href', '/specs/DM/DM-SHOP');
    expect(within(shop).getByText('UC requirements')).toBeInTheDocument();
    expect(within(shop).getByText('Domain rules')).toBeInTheDocument();
    expect(within(shop).getByRole('img', { name: 'designed: 2 of 2' })).toBeInTheDocument();
    expect(within(shop).getByRole('img', { name: 'proved: 1 of 2' })).toBeInTheDocument();
    expect(within(shop).getByRole('img', { name: 'proved: 0 of 1' })).toBeInTheDocument();
    // A full bar is drawn full; a partial one is drawn to its share.
    const fills = [...shop.querySelectorAll<HTMLElement>('.bar-fill')].map((f) => [f.style.width, f.classList.contains('full')]);
    expect(fills).toEqual([['100%', true], ['50%', false], ['50%', false], ['100%', true], ['100%', true], ['0%', false]]);
  });

  it('LA-BRW-T04 Coverage shows designed, built and proved, and a count the engine has not measured as unknown', async () => {
    await openApp('/specs/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(bars(card('Shopping'))).toEqual([
      'designed 2/2', 'built 1/2', 'proved 1/2',
      'designed 1/1', 'built 1/1', 'proved 0/1',
    ]);
    // DM-PAY's coverage has no built counts: they read "not yet measured", never zero.
    const pay = card('Paying');
    expect(bars(pay)).toEqual([
      'designed 0/1', 'built not yet measured', 'proved 0/1',
      'designed 0/0', 'built not yet measured', 'proved 0/0',
    ]);
    expect(within(pay).queryByRole('img', { name: /^built/ })).toBeNull();

    // The same three counts on the domain page.
    await openApp('/specs/DM/DM-PAY');
    expect(bars(section('Coverage'))).toContain('built not yet measured');
  });

  it('LA-BRW-T05 The product page lists its open questions with owners, and the problems in its records', async () => {
    await openApp('/specs/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const questions = section(/^Open questions/);
    const items = within(questions).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/DM-Q01.*Should the shop ship abroad\?.*owner Jared.*about DM/),
      expect.stringMatching(/DM-SHOP-Q01.*What happens to a basket overnight\?.*owner Ana.*about DM-SHOP-A1/),
    ]);

    const problems = within(section(/^Problems in this product/)).getAllByRole('listitem');
    // Only this product's problems, errors first.
    expect(problems.map((li) => li.querySelector('.severity')?.textContent)).toEqual(['error', 'warning', 'warning', 'warning']);
    expect(problems[0]).toHaveTextContent('DM-SHOP-T01');
    expect(main()).not.toHaveTextContent('NF-NOTE links to NF-NOTE-X9');
  });

  it('LA-BRW-T06 The product page shows the latest fitness and its history apart from the evidence, or says how to add one', async () => {
    await openApp('/specs/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const fitness = section('Fitness');
    const latest = fitness.querySelector('.fitness-latest') as HTMLElement;
    expect(within(latest).getByLabelText('Score 4 of 5')).toBeInTheDocument();
    expect(within(latest).getByText('2026-10-20')).toBeInTheDocument();
    expect(within(latest).getByText('two clicks').tagName).toBe('EM');
    expect(within(latest).getByRole('link', { name: 'DM-FIT02' })).toHaveAttribute('href', '/records/DM-FIT02');

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
    expect(value('Designed')).toBe('3 of 4 UC requirements and rules');
    expect(value('Built')).toBe('not yet measured'); // DM-PAY has no built counts yet
    expect(value('Proved')).toBe('1 of 4 UC requirements and rules');
    expect(value('Open questions')).toBe('2');
    expect(value('Errors')).toBe('1');
    expect(value('Warnings')).toBe('3');
    expect(within(evidence).queryByLabelText(/^Score/)).toBeNull();

    // A product with no fitness record says so, and links to the format section.
    await openApp('/specs/NF');
    await screen.findByRole('heading', { level: 1, name: 'Notebook' });
    const none = section('Fitness');
    expect(none).toHaveTextContent('No fitness recorded yet.');
    expect(within(none).getByRole('link', { name: /section 7: Fitness/ })).toHaveAttribute('href', '/format#7-fitness');
    expect(within(section('Evidence')).getByText('Built').nextElementSibling).toHaveTextContent('0 of 0 UC requirements and rules');
  });

  it('LA-BRW-T06 The format page shows the fitness section the product page links to', async () => {
    await openApp('/format#7-fitness');
    const heading = await screen.findByRole('heading', { name: '7. Fitness' });
    expect(heading).toHaveAttribute('id', '7-fitness');
  });
});
