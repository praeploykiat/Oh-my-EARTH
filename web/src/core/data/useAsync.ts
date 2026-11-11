import { useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: T };

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    load()
      .then((data) => active && setState({ status: 'ready', data }))
      .catch((error: Error) => active && setState({ status: 'error', error }));
    return () => {
      active = false;
    };
  }, deps);

  return state;
}
