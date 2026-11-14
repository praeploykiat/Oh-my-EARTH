import { useEffect, useState } from 'react';
import { useI18n } from './core/i18n';
import { splitHash } from './core/url';
import { Experience } from './features/experience';
import { Game } from './features/game';
import { GameAdmin } from './features/game/admin';
import { Methods } from './features/methods';
import { Workbench } from './features/workbench';
import { BrandMark, Footer, LanguageSwitcher } from './shared';

const ROUTES = {
  '/': Experience,
  '/workbench': Workbench,
  '/game': Game,
  '/game/admin': GameAdmin,
  '/methods': Methods,
} as const;

type Route = keyof typeof ROUTES;

function currentRoute(): Route {
  const { path } = splitHash(window.location.hash);
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
          <a href="#/game" aria-current={route === '/game'}>
            {t('nav.game')}
          </a>
          <a href="#/methods" aria-current={route === '/methods'}>
            {t('nav.methods')}
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
