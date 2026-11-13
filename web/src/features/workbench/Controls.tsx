import { useEffect, useState } from 'react';
import { VARIABLES } from '../../core/data';
import type { Place } from '../../core/geo';
import { useI18n } from '../../core/i18n';
import { ProvinceSelect, ThailandMap } from '../../shared';
import { placeName } from './placeName';

// Variable picker

interface VariablePickerProps {
  value: string | null;
  onChange: (key: string) => void;
}

export function VariablePicker({ value, onChange }: VariablePickerProps) {
  const { language, t } = useI18n();

  return (
    <div className="control">
      <span className="control-label">{t('workbench.variable')}</span>
      <div className="variable-chips" role="radiogroup" aria-label={t('workbench.variable')}>
        {VARIABLES.map((variable) => (
          <button
            key={variable.key}
            type="button"
            role="radio"
            aria-checked={variable.key === value}
            className="variable-chip"
            title={variable.description[language]}
            onClick={() => onChange(variable.key)}
          >
            {variable.label[language]}
          </button>
        ))}
      </div>
    </div>
  );
}

// Place picker

interface PlacePickerProps {
  label: string;
  value: Place | null;
  onChange: (place: Place) => void;
  onRemove?: () => void;
}

export function PlacePicker({ label, value, onChange, onRemove }: PlacePickerProps) {
  const { t } = useI18n();
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="control">
      <span className="control-label">{label}</span>
      <div className="place-row">
        <ProvinceSelect value={value?.provinceCode ?? null} onSelectPlace={onChange} />
        <button type="button" className="button-secondary button-compact" onClick={() => setMapOpen(true)}>
          {t('workbench.openMap')}
        </button>
        {onRemove && (
          <button
            type="button"
            className="button-secondary button-compact"
            aria-label={t('workbench.removeCompare')}
            onClick={onRemove}
          >
            ✕
          </button>
        )}
      </div>
      {mapOpen && (
        <MapDialog
          title={label}
          value={value}
          onClose={() => setMapOpen(false)}
          onSelect={(place) => {
            onChange(place);
            setMapOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Map dialog

interface MapDialogProps {
  title: string;
  value: Place | null;
  onSelect: (place: Place) => void;
  onClose: () => void;
}

function MapDialog({ title, value, onSelect, onClose }: MapDialogProps) {
  const { language, t } = useI18n();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="eyebrow">{title}</span>
          <button type="button" className="button-secondary button-compact" onClick={onClose}>
            {t('workbench.closeMap')}
          </button>
        </div>
        <ThailandMap selected={value} onSelectPlace={onSelect} />
        {value && <p className="dialog-note">{placeName(value, language)}</p>}
      </div>
    </div>
  );
}
