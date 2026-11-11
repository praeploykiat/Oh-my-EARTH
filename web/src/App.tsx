import { useEffect, useState } from 'react';
import { useI18n } from './core/i18n';
import { Experience } from './features/experience';
import { Workbench } from './features/workbench';
import { LanguageSwitcher } from './shared';

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
  const { t } = useI18n();
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
          {t('nav.experience')}
        </a>
        <a href="#/workbench" aria-current={route === '/workbench'}>
          {t('nav.workbench')}
        </a>
        <LanguageSwitcher />
      </nav>
      <main className="page">
        <Page />
      </main>
    </>
  );
}
