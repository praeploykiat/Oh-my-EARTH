import { useEffect, useState } from 'react';
import { useI18n } from './core/i18n';
import { Experience } from './features/experience';
import { Workbench } from './features/workbench';
import { BrandMark, Footer, LanguageSwitcher } from './shared';

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
    const onChange = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const Page = ROUTES[route];

  return (
    <div className="app">
      <header className="header">
        <a href="#/" className="brand">
          <BrandMark />
          <span>{t('app.title')}</span>
        </a>
        <nav className="nav-links" aria-label={t('nav.main')}>
          <a href="#/" aria-current={route === '/'}>
            {t('nav.experience')}
          </a>
          <a href="#/workbench" aria-current={route === '/workbench'}>
            {t('nav.workbench')}
          </a>
        </nav>
        <LanguageSwitcher />
      </header>

      <main className="main">
        <Page key={route} />
      </main>

      <Footer />
    </div>
  );
}
