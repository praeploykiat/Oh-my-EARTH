import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type MessageKey } from './en';
import { th } from './th';

export const LANGUAGES = {
  en: { label: 'EN', messages: en },
  th: { label: 'ไทย', messages: th },
} as const;

export type Language = keyof typeof LANGUAGES;
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const DEFAULT_LANGUAGE: Language = 'en';
const STORAGE_KEY = 'language';

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && value in LANGUAGES;
}

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function storeLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    return;
  }
}

export function interpolate(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = LANGUAGES[language].messages['app.title'];
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    storeLanguage(next);
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => interpolate(LANGUAGES[language].messages[key], vars),
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
