import { LANGUAGES, useI18n, type Language } from '../core/i18n';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="language-switcher" role="group" aria-label={t('language.label')}>
      {(Object.keys(LANGUAGES) as Language[]).map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={language === code}
          onClick={() => setLanguage(code)}
        >
          {LANGUAGES[code].label}
        </button>
      ))}
    </div>
  );
}
