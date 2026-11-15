import { useEffect, useState, type ReactNode } from 'react';
import { useI18n, type MessageKey } from './core/i18n';
import { splitHash } from './core/url';
import { Game } from './features/game';
import { GameAdmin } from './features/game/admin';
import { Hotspot } from './features/hotspot';
import { Landing } from './features/landing';
import { Methods } from './features/methods';
import { Workbench } from './features/workbench';
import { GlobalExplorer } from './features/global';
import { BrandMark, Footer, LanguageSwitcher } from './shared';

const ROUTES = {
  '/': Landing,
  '/workbench': Workbench,
  '/global': GlobalExplorer,
  '/game': Game,
  '/game/admin': GameAdmin,
  '/hotspot': Hotspot,
  '/methods': Methods,
} as const;

type Route = keyof typeof ROUTES;

function currentRoute(): Route {
  const { path } = splitHash(window.location.hash);
  return path in ROUTES ? (path as Route) : '/';
}

// Navigation

const NAV_ICONS: Record<string, ReactNode> = {
  game: <path d="M3 17l5-6 4 3 6-8 3 2" />,
  hotspot: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
    </>
  ),
  global: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  workbench: <path d="M10 3l3 2-1 4 3 3-2 3 2 3-3 3-2-4 1-4-3-3z" />,
  methods: (
    <>
      <path d="M5 4h10l4 4v12H5z" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
};

const NAV: { route: Route; icon: string; label: MessageKey; aside?: boolean }[] = [
  { route: '/game', icon: 'game', label: 'nav.game' },
  { route: '/hotspot', icon: 'hotspot', label: 'nav.hotspot' },
  { route: '/global', icon: 'global', label: 'nav.global' },
  { route: '/workbench', icon: 'workbench', label: 'nav.workbench' },
  { route: '/methods', icon: 'methods', label: 'nav.methods', aside: true },
];

function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}

// Shell

export function App() {
  const { t } = useI18n();
  const [route, setRoute] = useState<Route>(currentRoute);
  const scrolled = useScrolled();

  useEffect(() => {
    const onChange = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const Page = ROUTES[route];
  const section = route.split('/')[1] || 'home';

  return (
    <div className={`app is-${section}`}>
      <header className={`header ${scrolled ? 'is-scrolled' : ''}`}>
        <a href="#/" className="brand">
          <BrandMark />
          <span>{t('app.title')}</span>
        </a>
        <nav className="nav-links" aria-label={t('nav.main')}>
          {NAV.map((item) => (
            <a
              key={item.route}
              href={`#${item.route}`}
              className={item.aside ? 'nav-aside' : undefined}
              aria-current={route === item.route || (item.route === '/game' && route === '/game/admin') ? 'page' : undefined}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {NAV_ICONS[item.icon]}
              </svg>
              {t(item.label)}
            </a>
          ))}
        </nav>
        <LanguageSwitcher />
      </header>

      <main className="main">
        <div className="page" key={route}>
          <Page />
        </div>
      </main>

      <Footer />
    </div>
  );
}
