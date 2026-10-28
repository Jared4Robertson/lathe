import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { main, openApp, section } from './helpers';

const card = (title: string) => within(section(/^Domains/)).getByText(title).closest('article') as HTMLElement;
const bars = (element: HTMLElement) =>
  [...element.querySelectorAll('.bar')].map((bar) => [...bar.children].map((c) => c.textContent).filter(Boolean).join(' '));

describe('product page', () => {
  it('LA-V51-R01-T01 The product page shows each domain as a card with its coverage bars and counts', async () => {
    await openApp('/DM');
    expect(await screen.findByRole('heading', { level: 1, name: 'Demo shop' })).toBeInTheDocument();
    const cards = within(section(/^Domains/)).getAllByRole('article');
    expect(cards).toHaveLength(2);

    const shop = card('Shopping');
    expect(within(shop).getByRole('link', { name: /DM-SHOP\s*Shopping/ })).toHaveAttribute('href', '/DM-SHOP');
    expect(within(shop).getByText('UC requirements')).toBeInTheDocument();
    expect(within(shop).getByText('Invariants')).toBeInTheDocument();
    expect(within(shop).getByRole('img', { name: 'designed: 2 of 2' })).toBeInTheDocument();
    expect(within(shop).getByRole('img', { name: 'proved: 1 of 2' })).toBeInTheDocument();
    expect(within(shop).getByRole('img', { name: 'proved: 0 of 1' })).toBeInTheDocument();
    // A full bar is drawn full; a partial one is drawn to its share.
    const fills = [...shop.querySelectorAll<HTMLElement>('.bar-fill')].map((f) => [f.style.width, f.classList.contains('full')]);
    expect(fills).toEqual([
      ['100%', true], ['0%', false], ['0%', false], ['100%', false],
      ['100%', true], ['50%', false], ['50%', false], ['0%', false],
    ]);
  });

  it('LA-V51-R01-T02 Coverage shows designed, built and proved on the product and domain pages', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(bars(card('Shopping'))).toEqual([
      'designed 1/1', 'built 0/1', 'proved 0/1', 'not automated 1/1',
      'designed 2/2', 'built 1/2', 'proved 1/2', 'not automated 0/2',
    ]);
    // A count of zero is drawn as a bar like any other; a kind with no obligations in the domain draws none.
    const pay = card('Paying');
    expect(bars(pay)).toEqual(['designed 0/1', 'built 0/1', 'proved 0/1', 'not automated 0/1']);
    expect(within(pay).getAllByRole('img', { name: /^built: 0 of/ })).toHaveLength(1);

    // The same counts on the domain page.
    await openApp('/DM-PAY');
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    expect(bars(section('Coverage'))).toEqual(bars(pay));
  });

  it('LA-V51-R02-T01 The product page lists its open questions with owners, and the problems in its records', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const questions = section(/^Open questions/);
    const items = within(questions).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/DM-Q01.*Should the shop ship abroad\?.*owner Owner.*about DM/),
      expect.stringMatching(/DM-SHOP-Q01.*What happens to a basket overnight\?.*owner Owner.*about DM-SHOP-A1/),
    ]);

    const problems = within(section(/^Problems in this product/)).getAllByRole('listitem');
    // Only this product's problems, errors first.
    expect(problems.map((li) => li.querySelector('.severity')?.textContent)).toEqual(['error', 'warning', 'warning', 'warning']);
    expect(problems[0]).toHaveTextContent('DM-SHOP-UC01-R01-T01');
    expect(main()).not.toHaveTextContent('NF-NOTE has no use cases yet');
  });

  it('LA-V90-R21-T02 The product page lists what it shares in its stages, each in its stage\'s color', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    // Both domains use the value object and the view, so the product shares them.
    const level = section(/^Shared\s*\d/);
    const stages = [...level.querySelectorAll('.stage')].map((s) => [s.className, s.querySelector('.stage-title')?.textContent]);
    expect(stages).toEqual([
      ['stage stage-domain-model', 'Domain model1'],
      ['stage stage-interaction-design', 'Interaction design1'],
    ]);
    expect(within(level).getByRole('heading', { name: /^Value objects/ })).toBeInTheDocument();
    expect(within(level).getByRole('heading', { name: /^Views/ })).toBeInTheDocument();
    expect(within(level).getByRole('link', { name: /DM-V01\s*Basket page/ })).toHaveAttribute('href', '/DM-V01');
    // A domain's records are never listed in Shared.
    expect(level).not.toHaveTextContent('DM-SHOP-SP01');
  });

  it("LA-V51-R03-T01 The product page sums up the product's coverage, open questions and problems", async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const summary = section('Summary');
    const value = (name: string) => within(summary).getByText(name).nextElementSibling?.textContent;
    expect(value('Designed')).toBe('3 of 6 obligations');
    expect(value('Built')).toBe('1 of 6 obligations');
    expect(value('Proved')).toBe('1 of 6 obligations');
    expect(value('Open questions')).toBe('2');
    expect(value('Errors')).toBe('1');
    expect(value('Warnings')).toBe('3');

    // A product with nothing to count says so in numbers.
    await openApp('/NF');
    await screen.findByRole('heading', { level: 1, name: 'Notebook' });
    expect(within(section('Summary')).getByText('Built').nextElementSibling).toHaveTextContent('0 of 0 obligations');
  });
});
