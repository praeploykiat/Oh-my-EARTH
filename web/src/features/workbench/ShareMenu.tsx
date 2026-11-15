import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../core/i18n";

const SITE_TITLE = "Oh my EARTH!";

interface ShareTarget {
  label: string;
  href: (text: string, url: string) => string;
}

const TARGETS: ShareTarget[] = [
  {
    label: "LINE",
    href: (text, url) =>
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    label: "Facebook",
    href: (_, url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    label: "X",
    href: (text, url) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
];

function prefersNativeShare(): boolean {
  return (
    typeof navigator.share === "function" &&
    window.matchMedia?.("(pointer: coarse)").matches === true
  );
}

export function ShareMenu({ text }: { text: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const message = text;

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (
        event instanceof MouseEvent &&
        ref.current?.contains(event.target as Node)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const share = async () => {
    if (!prefersNativeShare()) {
      setOpen((value) => !value);
      return;
    }
    try {
      await navigator.share({
        title: SITE_TITLE,
        text: message,
        url: window.location.href,
      });
    } catch {
      return;
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${message}\n${window.location.href}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="share" ref={ref}>
      <button
        type="button"
        className="button-compact"
        aria-expanded={open}
        onClick={share}
      >
        {t("share.button")}
      </button>
      {open && (
        <div className="share-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="share-item"
            onClick={copy}
          >
            {copied ? t("share.copied") : t("share.copy")}
          </button>
          {TARGETS.map((target) => (
            <a
              key={target.label}
              role="menuitem"
              className="share-item"
              href={target.href(message, window.location.href)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              {target.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
