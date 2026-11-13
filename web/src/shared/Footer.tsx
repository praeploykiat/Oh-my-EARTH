import { useI18n } from '../core/i18n';
import { BrandMark } from './BrandMark';

const REPO_URL = 'https://github.com/praeploykiat/space-apps-challenge-th';
const CHALLENGE_URL = 'https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/';
const DATA_URL = '#/methods';

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <BrandMark size={24} />
          <div>
            <strong>{t('footer.team')}</strong>
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

      <p className="footer-disclaimer">{t('footer.disclaimer')}</p>
    </footer>
  );
}
