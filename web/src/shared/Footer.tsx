import { useI18n } from '../core/i18n';

const REPO_URL = 'https://github.com/praeploykiat/space-apps-challenge-th';
const CHALLENGE_URL = 'https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/';
const DATA_URL = '#/methods';

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div>
            <p className="footer-by">
              {t('footer.by')} <strong>{t('footer.team')}</strong>
            </p>
            <span>{t('footer.event')}</span>
          </div>
        </div>

        <nav className="footer-links" aria-label={t('footer.links')}>
          <a href={CHALLENGE_URL} target="_blank" rel="noreferrer">
            {t('footer.challenge')}
          </a>
          <a href={DATA_URL}>
            {t('footer.data')}
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {t('footer.source')}
          </a>
        </nav>
      </div>

      <p className="footer-disclaimer">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 7v4.2M8 4.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {t('footer.disclaimer')}
      </p>
    </footer>
  );
}
