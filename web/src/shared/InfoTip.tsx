import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../core/i18n';

export function InfoTip({ text }: { text: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && ref.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <span className="info-tip" ref={ref}>
      <button
        type="button"
        className="info-tip-button"
        aria-label={t('info.label')}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <span id={id} role="tooltip" className="info-tip-bubble">
          {text}
        </span>
      )}
    </span>
  );
}
