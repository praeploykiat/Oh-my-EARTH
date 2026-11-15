import type { ReactNode } from 'react';

export function withUnit(label: string, unit: string): string {
  return unit.trim() ? `${label} (${unit.trim()})` : label;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export function Answer({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className="game-answer">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((line) => line.trim());
        if (lines.length > 0 && lines.every((line) => /^\s*[-*]\s+/.test(line))) {
          return (
            <ul key={i}>
              {lines.map((line, j) => (
                <li key={j}>{inline(line.replace(/^\s*[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
