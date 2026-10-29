import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { navigate } from '../router';
import type { ProductSummary } from '../../../lathe/src/authoring/product/read-model';
import { useProducts } from '../authoring/product/reads';
import { parseSpecRoute, spaceIndex, type SpecIndex } from '../specs/data';
import { addressOf, isFocusPath } from '../views/address';
import { withoutOverlays } from '../views/overlays';
import { usePref } from './prefs';

// Spaces: each product is its own space, as a workspace is in Slack, Discord, Linear or Notion, and
// the spaces are kept hard apart. The rail at the far left of the nav has one icon per product; the
// current space is the product of the page you are on (or the last one you chose, on a page that
// belongs to no product, kept from one launch to the next). Everything inside a space reads the
// space's own index (spaceIndex): the nav, quick find, the Checks panel, the graph, the ERD view, the
// wiki card and the format reference's records, so nothing of another product shows in it. Choosing a
// space opens the last page you visited in it this session, or its product page; the tools open over
// it are not part of that page.

export interface Space {
  id: string;
  title: string;
  /** What the icon shows: the product's `icon` field, or its monogram. */
  mark: string;
  /** True when `mark` is the monogram drawn from the ID. */
  monogram: boolean;
  /** The icon's background color: the product's `color` field, or one derived from its ID. */
  color: string;
}

/** The ID prefix as a monogram: "TL", "LA". */
export const monogramOf = (id: string) => id.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

const graphemes = (text: string): number => {
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (t: string) => Iterable<unknown> } }).Segmenter;
  return Segmenter ? [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length : [...text].length;
};

/** A product's `icon` field when it is one emoji or up to two characters, else null. */
export function iconField(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v || /\s/.test(v)) return null;
  return graphemes(v) <= 2 ? v : null;
}

/** A product's `color` field when it is a hex color or a CSS color name, else null. */
export function colorField(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) || /^[a-z]{3,20}$/i.test(v) ? v : null;
}

/** A stable color for an ID: the same ID always gets the same hue, dark enough for white text. */
export function colorOf(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return `hsl(${h % 360} 48% 36%)`;
}

/** A product's space, from the product as the Product aggregate lists it (list-products). */
export function spaceOf(product: ProductSummary): Space {
  const icon = iconField(product.icon);
  return {
    id: product.id,
    title: product.title,
    mark: icon ?? monogramOf(product.id),
    monogram: icon === null,
    color: colorField(product.color) ?? colorOf(product.id),
  };
}

/** The product a page belongs to, or null for a page outside every space (the products picker). */
export function productOfPath(index: SpecIndex | null, path: string): string | null {
  const route = parseSpecRoute(path, index);
  if (!route || !index) return null;
  const productOfRecord = (id: string) => index.byId.get(id)?.product ?? null;
  const known = (id: string) => (index.byId.get(id)?.kind === 'product' ? id : null);
  switch (route.page) {
    case 'product': return known(route.product);
    case 'domain': return known(route.product) ?? productOfRecord(route.domain);
    case 'record': return productOfRecord(route.id);
    case 'group': return productOfRecord(route.parent);
    default: return null;
  }
}

const SPACE_KEY = 'lathe:space';
const PAGES_KEY = 'lathe:space-pages';
const isString = (v: unknown): v is string => typeof v === 'string';
const isPages = (v: unknown): v is Record<string, string> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isString);

export interface SpacesApi {
  /** Every product's space, in rail order (the products' ID order), as the Product aggregate lists them. */
  spaces: Space[];
  /** Whether the products have been read: until then `spaces` is empty, and the nav keeps the rail as it was. */
  read: boolean;
  /** The current space, or null while there are no products. */
  current: Space | null;
  /** The current space's index: its own records and problems only (the whole workspace while there are no products). */
  index: SpecIndex | null;
  /** True when the page on screen belongs to the current space. */
  onPage: boolean;
  /** The space the Reader was last in (kept from one launch to the next), or null on a first launch. */
  last: Space | null;
  /** Opens a space: the last page visited in it this session, or its product page. */
  go: (id: string) => void;
  /** The last page visited in a space, if any. */
  lastPage: (id: string) => string | undefined;
}

const SpacesContext = createContext<SpacesApi | null>(null);

/** The spaces, or null outside the shell. */
export const useSpaces = () => useContext(SpacesContext);

/** Works out the current space and remembers each space's last page (for the session). */
export function useSpaceState(index: SpecIndex | null, path: string, search: string): SpacesApi {
  // The products, read through the Product aggregate's own query, again whenever the data is.
  const products = useProducts(index);
  const listed = products.state === 'read' ? products.answer : null;
  const spaces = useMemo(() => (listed ?? []).map(spaceOf), [listed]);
  const [chosen, setChosen] = usePref<string>(SPACE_KEY, '', isString);
  const [stored, setPages] = usePref<Record<string, string>>(PAGES_KEY, {}, isPages, 'session');
  // A saved page that is not a page of a space is dropped.
  const pages = useMemo(() => Object.fromEntries(Object.entries(stored).filter(([, page]) => isFocusPath(page.split('?')[0]))), [stored]);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const pageProduct = productOfPath(index, path);

  useEffect(() => {
    if (!pageProduct) return;
    setChosen((c) => (c === pageProduct ? c : pageProduct));
    const here = path + withoutOverlays(search);
    setPages((p) => (p[pageProduct] === here ? p : { ...p, [pageProduct]: here }));
  }, [pageProduct, path, search, setChosen, setPages]);

  const currentId = pageProduct ?? (spaces.some((s) => s.id === chosen) ? chosen : spaces[0]?.id ?? null);
  const current = spaces.find((s) => s.id === currentId) ?? null;
  const scoped = useMemo(() => (index && current ? spaceIndex(index, current.id) : index), [index, current?.id]);
  const go = useCallback((id: string) => {
    setChosen(id);
    navigate(pagesRef.current[id] ?? addressOf(id));
  }, [setChosen]);
  const lastPage = useCallback((id: string) => pages[id], [pages]);
  const last = spaces.find((s) => s.id === (pageProduct ?? chosen)) ?? null;
  return useMemo(() => ({ spaces, read: listed !== null, current, index: scoped, onPage: !!pageProduct && pageProduct === current?.id, last, go, lastPage }), [spaces, listed, current, scoped, pageProduct, last, go, lastPage]);
}

export function SpacesProvider({ value, children }: { value: SpacesApi; children: ReactNode }) {
  return <SpacesContext.Provider value={value}>{children}</SpacesContext.Provider>;
}

/** A space's square icon: its emoji or characters, or its monogram on its color. */
export function SpaceMark({ space, size = 32 }: { space: Space; size?: number }) {
  return (
    <span
      className={`space-mark${space.monogram ? ' is-monogram' : ' is-icon'}`}
      style={{ width: size, height: size, ...(space.monogram ? { background: space.color } : { borderColor: space.color }) }}
      aria-hidden="true"
      data-mark={space.mark}
    >
      {space.mark}
    </span>
  );
}
