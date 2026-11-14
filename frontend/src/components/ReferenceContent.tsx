import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        if (href.startsWith('/')) {
          nodes.push(
            <Link key={key++} to={href} className="ref-md-link">
              {label}
            </Link>,
          );
        } else {
          nodes.push(
            <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="ref-md-link">
              {label}
            </a>,
          );
        }
      } else {
        nodes.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length ? nodes : [text];
}

export function ReferenceContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let listTag: 'ul' | 'ol' | null = null;
  let blockKey = 0;

  const flushList = () => {
    if (!listTag || listItems.length === 0) return;
    if (listTag === 'ul') {
      blocks.push(<ul key={blockKey++}>{listItems}</ul>);
    } else {
      blocks.push(<ol key={blockKey++}>{listItems}</ol>);
    }
    listItems = [];
    listTag = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s+(.*)$/);

    if (line.startsWith('### ')) {
      flushList();
      blocks.push(<h3 key={blockKey++}>{parseInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      flushList();
      blocks.push(<h2 key={blockKey++}>{parseInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      flushList();
      blocks.push(<h1 key={blockKey++}>{parseInline(line.slice(2))}</h1>);
    } else if (line.startsWith('- ')) {
      if (listTag !== 'ul') {
        flushList();
        listTag = 'ul';
      }
      listItems.push(<li key={listItems.length}>{parseInline(line.slice(2))}</li>);
    } else if (numbered) {
      if (listTag !== 'ol') {
        flushList();
        listTag = 'ol';
      }
      listItems.push(<li key={listItems.length}>{parseInline(numbered[2])}</li>);
    } else {
      flushList();
      blocks.push(<p key={blockKey++}>{parseInline(line)}</p>);
    }
  }

  flushList();

  return <div className="ref-md">{blocks}</div>;
}

/** Plain-text excerpt for meta descriptions. */
export function markdownExcerpt(text: string, maxLen = 160): string {
  const plain = text
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^-\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1).trim()}…`;
}

/** Server-side HTML (seo.ts can import equivalent logic separately). */
export function renderReferenceMarkdown(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inList = false;
  let listTag = 'ul';

  const link = (s: string) =>
    s
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  const closeList = () => {
    if (inList) {
      out.push(`</${listTag}>`);
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/);

    if (trimmed.startsWith('### ')) {
      closeList();
      out.push(`<h3>${link(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      closeList();
      out.push(`<h2>${link(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      closeList();
      out.push(`<h1>${link(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith('- ')) {
      if (!inList || listTag !== 'ul') {
        closeList();
        out.push('<ul>');
        inList = true;
        listTag = 'ul';
      }
      out.push(`<li>${link(trimmed.slice(2))}</li>`);
    } else if (numbered) {
      if (!inList || listTag !== 'ol') {
        closeList();
        out.push('<ol>');
        inList = true;
        listTag = 'ol';
      }
      out.push(`<li>${link(numbered[2])}</li>`);
    } else {
      closeList();
      out.push(`<p>${link(trimmed)}</p>`);
    }
  }

  closeList();
  return out.join('');
}
