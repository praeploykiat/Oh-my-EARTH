import { describe, expect, it } from 'vitest';
import { markdownToHtml } from './richText';

describe('answer rich text', () => {
  it('turns bold, lists and paragraphs into editor markup', () => {
    expect(markdownToHtml('**Haze** follows fires.\n\n- one\n- two')).toBe('<div><b>Haze</b> follows fires.</div><ul><li>one</li><li>two</li></ul>');
  });

  it('escapes html typed as text', () => {
    expect(markdownToHtml('<script>x</script>')).toBe('<div>&lt;script&gt;x&lt;/script&gt;</div>');
  });

  it('starts with an empty line when there is no text', () => {
    expect(markdownToHtml('  ')).toBe('<div><br></div>');
  });
});
