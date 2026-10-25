import { useContext, useMemo, type MouseEvent } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { navigate } from '../router';
import { NavigateContext } from './parts';

/** "7. Fitness" -> "7-fitness": the anchor a heading gets, so a page can link to a section. */
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
  /** The IDs the record mentions (they exist), with the title each link shows on hover. */
  titles: ReadonlyMap<string, string>;
  /** IDs the engine reported as citing no record: shown with a broken-link style, not linked. */
  broken: ReadonlySet<string>;
  /** Where a mentioned ID links to. */
  href: (id: string) => string;
}

/** An ID-shaped token: capital letters and digits in parts joined by hyphens, not inside a longer word. */
const ID_TOKEN = /(?<![A-Za-z0-9_-])[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*(?![A-Za-z0-9_])/g;
/** Text inside these is never linked. */
const SKIP = new Set(['CODE', 'PRE', 'A', 'KBD', 'SAMP', 'SCRIPT', 'STYLE']);

/** Turns every mentioned ID in the HTML's text (outside code and links, plus code spans holding one lone ID) into a link, and marks unknown IDs. */
export function linkMentions(html: string, links: ProseLinks): string {
  if (links.titles.size === 0 && links.broken.size === 0) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  // An inline code span holding one lone ID is a citation (FORMAT.md section 12): wrap the code in the link.
  for (const code of Array.from(template.content.querySelectorAll('code'))) {
    if (code.closest('pre, a')) continue;
    const id = (code.textContent ?? '').trim();
    const title = links.titles.get(id);
    if (title === undefined && !links.broken.has(id)) continue;
    const wrap = title !== undefined ? document.createElement('a') : document.createElement('span');
    if (wrap instanceof HTMLAnchorElement) {
      wrap.href = links.href(id);
      wrap.className = 'mention';
      wrap.title = title!;
      wrap.dataset.mention = id;
    } else {
      wrap.className = 'mention broken';
      wrap.title = `No record has the ID ${id}`;
    }
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
      if (title === undefined && !links.broken.has(id)) continue;
      parts.push(value.slice(last, m.index));
      if (title !== undefined) {
        const a = document.createElement('a');
        a.href = links.href(id);
        a.className = 'mention';
        a.title = title;
        a.dataset.mention = id;
        a.textContent = id;
        parts.push(a);
      } else {
        const span = document.createElement('span');
        span.className = 'mention broken';
        span.title = `No record has the ID ${id}`;
        span.textContent = id;
        parts.push(span);
      }
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
  // A code block scrolls sideways in its own box, so it takes focus for the arrow keys (LA-PLT-DR23).
  const html = DOMPurify.sanitize(marked.parse(source, { async: false })).replace(/<pre>/g, '<pre tabindex="0">');
  return links ? linkMentions(html, links) : html;
}

export function Markdown({ source, links }: { source: string; links?: ProseLinks }) {
  const html = useMemo(() => renderMarkdown(source, links), [source, links]);
  const onNavigate = useContext(NavigateContext);
  if (!source.trim()) return <p className="hint">No body text.</p>;
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
