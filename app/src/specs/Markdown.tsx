import { useContext, useMemo, type MouseEvent } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { navigate } from '../router';
import { NavigateContext } from './parts';

/** "7. What records do not carry" -> "7-what-records-do-not-carry": the anchor a heading gets, so a page can link to a section. */
export const headingId = (text: string) =>
  text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const marked = new Marked({
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${headingId(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

/** Record IDs to turn into links in rendered prose. */
export interface ProseLinks {
  /** The IDs the text names that are records, with the title each link shows on hover. */
  titles: ReadonlyMap<string, string>;
  /** Where a named ID links to. */
  href: (id: string) => string;
}

/** An ID-shaped token: capital letters and digits in parts joined by hyphens, not inside a longer word. */
export const ID_TOKEN = /(?<![A-Za-z0-9_-])[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*(?![A-Za-z0-9_])/g;
/** Text inside these is never linked. */
const SKIP = new Set(['CODE', 'PRE', 'A', 'KBD', 'SAMP', 'SCRIPT', 'STYLE']);

/** Turns every named record ID in the HTML's text (outside code and links, plus code spans holding one lone ID) into a link. */
export function linkMentions(html: string, links: ProseLinks): string {
  if (links.titles.size === 0) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  // An inline code span holding one lone ID names that record: wrap the code in the link.
  for (const code of Array.from(template.content.querySelectorAll('code'))) {
    if (code.closest('pre, a')) continue;
    const id = (code.textContent ?? '').trim();
    const title = links.titles.get(id);
    if (title === undefined) continue;
    const wrap = document.createElement('a');
    wrap.href = links.href(id);
    wrap.className = 'mention';
    wrap.title = title;
    wrap.dataset.mention = id;
    code.replaceWith(wrap);
    wrap.appendChild(code);
  }
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    let el = n.parentElement;
    let skip = false;
    while (el) { if (SKIP.has(el.tagName)) { skip = true; break; } el = el.parentElement; }
    if (!skip) texts.push(n as Text);
  }
  for (const text of texts) {
    const value = text.data;
    const parts: (string | Node)[] = [];
    let last = 0;
    for (const m of value.matchAll(ID_TOKEN)) {
      const id = m[0];
      const title = links.titles.get(id);
      if (title === undefined) continue;
      parts.push(value.slice(last, m.index));
      const a = document.createElement('a');
      a.href = links.href(id);
      a.className = 'mention';
      a.title = title;
      a.dataset.mention = id;
      a.textContent = id;
      parts.push(a);
      last = m.index + id.length;
    }
    if (parts.length === 0) continue;
    parts.push(value.slice(last));
    text.replaceWith(...parts.filter((p) => p !== ''));
  }
  return template.innerHTML;
}

/** Renders Markdown to HTML and sanitizes it, since records are written by agents as well as people. */
export function renderMarkdown(source: string, links?: ProseLinks): string {
  // A code block scrolls sideways in its own box, so it takes focus for the arrow keys (LA-V61-R46).
  const html = DOMPurify.sanitize(marked.parse(source, { async: false })).replace(/<pre>/g, '<pre tabindex="0">');
  return links ? linkMentions(html, links) : html;
}

export function Markdown({ source, links }: { source: string; links?: ProseLinks }) {
  const html = useMemo(() => renderMarkdown(source, links), [source, links]);
  const onNavigate = useContext(NavigateContext);
  // A mention link moves within the app on a plain click, as every other record link does.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest?.('a.mention');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const to = a.getAttribute('href');
    if (!to) return;
    e.preventDefault();
    if (onNavigate) onNavigate(to);
    else { navigate(to); window.scrollTo(0, 0); }
  };
  return <div className="markdown" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
