import { crossCheckUrl, variableByKey, type Dataset, type Origin } from '../core/data';
import { useI18n } from '../core/i18n';

interface SourceNoteProps {
  dataset: Dataset;
  origin?: Origin;
}

export function SourceNote({ dataset, origin }: SourceNoteProps) {
  const { t } = useI18n();
  const { provider, product, url, synthetic } = dataset.source;
  const checkUrl = crossCheckUrl(dataset);
  const satellites = variableByKey(dataset.variable.key)?.satellites ?? [];

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
      <span className="source-satellites">
        {satellites.length > 0 ? t('source.satellites', { satellites: satellites.join(', ') }) : t('source.model')}
      </span>
      {origin === 'live' && <span className="badge badge-live">{t('source.live')}</span>}
      {origin === 'saved' && <span className="badge">{t('source.saved')}</span>}
      {synthetic && <span className="badge">{t('source.synthetic')}</span>}
      {checkUrl && (
        <a className="source-check" href={checkUrl} target="_blank" rel="noreferrer">
          {t('source.crossCheck')} ↗
        </a>
      )}
    </div>
  );
}
