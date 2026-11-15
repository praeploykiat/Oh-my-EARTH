import { useI18n } from '../../core/i18n';

// Placeholder until the hotspot map is merged in

export function Hotspot() {
  const { t } = useI18n();
  return (
    <div className="placeholder-page">
      <h1>{t('nav.hotspot')}</h1>
      <p>{t('hotspot.soon')}</p>
      <a href="#/workbench">{t('landing.thailandCta')}</a>
    </div>
  );
}
