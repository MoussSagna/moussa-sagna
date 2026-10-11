import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '../data/navigation';
import { SiteHeader } from './SiteHeader';

/** Gabarit commun à toutes les pages du portfolio (hors intro) : en-tête, contenu, pied de page. */
export function Layout() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  const toggleMenu = useCallback((open: boolean) => setMenuOpen(open), []);

  // À chaque changement de page : fermer le menu, remonter en haut et placer le focus sur le contenu.
  useEffect(() => {
    setMenuOpen(false);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle('is-locked', menuOpen);
    return () => document.body.classList.remove('is-locked');
  }, [menuOpen]);

  return (
    <div className="app">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <SiteHeader menuOpen={menuOpen} onMenuToggle={toggleMenu} />
      <div key={`wipe-${pathname}`} className="route-wipe" aria-hidden="true" />
      <main ref={mainRef} id="contenu" className="page-enter" key={pathname} tabIndex={-1} inert={menuOpen}>
        <Outlet />
      </main>
      <footer className="site-footer" inert={menuOpen}>
        <p>Moussa — Tokyo Underground</p>
        <ul className="site-footer__links">
          <li>
            <Link to={ROUTES.intro}>Revoir l’intro</Link>
          </li>
          <li>
            <Link to={ROUTES.contact}>Contact</Link>
          </li>
        </ul>
      </footer>
    </div>
  );
}
