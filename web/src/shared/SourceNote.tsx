import type { Dataset } from '../core/data';
import { useI18n } from '../core/i18n';

export function SourceNote({ dataset }: { dataset: Dataset }) {
  const { t } = useI18n();
  const { provider, product, url, synthetic } = dataset.source;

  return (
    <div className="source-note">
      <span className="source-label">{t('source.label')}</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {provider}
        </a>
      ) : (
        <span>{provider}</span>
      )}
      <span>{product}</span>
      {synthetic && <span className="badge">{t('source.synthetic')}</span>}
    </div>
  );
}
