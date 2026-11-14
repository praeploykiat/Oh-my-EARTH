import type { Place } from '../../core/geo';
import { useI18n } from '../../core/i18n';
import { ProvinceSelect } from '../../shared';

interface PlacePickerProps {
  label: string;
  value: Place | null;
  active?: boolean;
  onChange: (place: Place) => void;
  onFocus?: () => void;
  onRemove?: () => void;
}

export function PlacePicker({ label, value, active, onChange, onFocus, onRemove }: PlacePickerProps) {
  const { t } = useI18n();

  return (
    <div className={`control place-picker ${active ? 'is-active' : ''}`} onFocusCapture={onFocus} onClick={onFocus}>
      <span className="control-label">{label}</span>
      <div className="place-row">
        <ProvinceSelect value={value?.provinceCode ?? null} onSelectPlace={onChange} />
        {onRemove && (
          <button
            type="button"
            className="button-secondary button-compact"
            aria-label={t('workbench.removeCompare')}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
