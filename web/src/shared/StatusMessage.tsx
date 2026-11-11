import type { AsyncState } from '../core/data';
import { useI18n } from '../core/i18n';

interface StatusMessageProps {
  state: AsyncState<unknown>;
}

export function StatusMessage({ state }: StatusMessageProps) {
  const { t } = useI18n();
  if (state.status === 'loading') return <p className="status">{t('status.loading')}</p>;
  if (state.status === 'error') return <p className="status is-error">{state.error.message}</p>;
  return null;
}
