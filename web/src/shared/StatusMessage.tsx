import type { AsyncState } from '../core/data';

interface StatusMessageProps {
  state: AsyncState<unknown>;
}

export function StatusMessage({ state }: StatusMessageProps) {
  if (state.status === 'loading') return <p className="status">Loading…</p>;
  if (state.status === 'error') return <p className="status is-error">{state.error.message}</p>;
  return null;
}
