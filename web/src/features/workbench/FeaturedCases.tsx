import { loadFeaturedCases, useAsync, variableByKey, type FeaturedCase } from '../../core/data';
import { useI18n } from '../../core/i18n';
import { placeName } from './placeName';

interface FeaturedCasesProps {
  activeId: string | null;
  onOpen: (featured: FeaturedCase) => void;
}

export function FeaturedCases({ activeId, onOpen }: FeaturedCasesProps) {
  const { language, t } = useI18n();
  const cases = useAsync(loadFeaturedCases, []);
  if (cases.status !== 'ready' || cases.data.length === 0) return null;

  return (
    <div className="featured">
      <span className="control-label">{t('workbench.featured')}</span>
      <div className="featured-list">
        {cases.data.map((featured, i) => {
          const variable = variableByKey(featured.variable);
          return (
            <button
              key={featured.id}
              type="button"
              className="featured-case"
              aria-pressed={featured.id === activeId}
              onClick={() => onOpen(featured)}
            >
              <span className="featured-number">{t('workbench.caseNumber', { number: String(i + 1).padStart(2, '0') })}</span>
              <strong>{variable ? variable.label[language] : featured.variable}</strong>
              <span>{placeName(featured.place, language)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
