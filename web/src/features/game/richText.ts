const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inlineToHtml(line: string): string {
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? `<b>${escape(part.slice(2, -2))}</b>` : escape(part)))
    .join('');
}

export function markdownToHtml(text: string): string {
  const blocks = text.trim() ? text.trim().split(/\n\s*\n/) : [];
  if (blocks.length === 0) return '<div><br></div>';
  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((line) => line.trim());
      if (lines.length > 0 && lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${inlineToHtml(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<div>${lines.map(inlineToHtml).join('<br>')}</div>`;
    })
    .join('');
}

function isBold(el: Element): boolean {
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') return true;
  const weight = (el as HTMLElement).style?.fontWeight;
  return weight === 'bold' || Number(weight) >= 600;
}

function inlineToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/ /g, ' ').replace(/\*/g, '');
  if (!(node instanceof Element)) return '';
  if (node.tagName === 'BR') return '\n';
  const inner = [...node.childNodes].map(inlineToMarkdown).join('');
  if (isBold(node) && inner.trim()) {
    const lead = inner.match(/^\s*/)![0];
    const tail = inner.match(/\s*$/)![0];
    return `${lead}**${inner.trim()}**${tail}`;
  }
  return inner;
}

const BLOCKS = new Set(['DIV', 'P', 'UL', 'OL', 'H1', 'H2', 'H3', 'BLOCKQUOTE']);

const hasBlockChild = (el: Element) => [...el.children].some((child) => BLOCKS.has(child.tagName));

function collectBlocks(parent: Node, blocks: string[]): void {
  let loose = '';
  const flush = () => {
    const text = loose.replace(/\n+$/, '').trim();
    if (text) blocks.push(text);
    loose = '';
  };

  for (const node of parent.childNodes) {
    if (!(node instanceof Element) || !BLOCKS.has(node.tagName)) {
      loose += inlineToMarkdown(node);
      continue;
    }
    flush();
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      const items = [...node.querySelectorAll('li')].map((li) => inlineToMarkdown(li).replace(/\n+/g, ' ').trim()).filter(Boolean);
      if (items.length) blocks.push(items.map((item) => `- ${item}`).join('\n'));
    } else if (hasBlockChild(node)) {
      collectBlocks(node, blocks);
    } else {
      const text = inlineToMarkdown(node).replace(/\n+$/, '').trim();
      if (text) blocks.push(text);
    }
  }
  flush();
}

export function htmlToMarkdown(root: HTMLElement): string {
  const blocks: string[] = [];
  collectBlocks(root, blocks);
  return blocks.join('\n\n');
}
