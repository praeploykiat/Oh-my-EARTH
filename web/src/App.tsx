import { useEffect, useState } from 'react';
import { Experience } from './features/experience';
import { Workbench } from './features/workbench';

const ROUTES = {
  '/': Experience,
  '/workbench': Workbench,
} as const;

type Route = keyof typeof ROUTES;

function currentRoute(): Route {
  const path = window.location.hash.replace(/^#/, '') || '/';
  return path in ROUTES ? (path as Route) : '/';
}

export function App() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const Page = ROUTES[route];

  return (
    <>
      <nav className="nav">
        <a href="#/" aria-current={route === '/'}>
          Experience
        </a>
        <a href="#/workbench" aria-current={route === '/workbench'}>
          Workbench
        </a>
      </nav>
      <main className="page">
        <Page />
      </main>
    </>
  );
}
