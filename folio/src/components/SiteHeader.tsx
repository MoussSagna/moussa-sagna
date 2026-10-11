import { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { NAV_ITEMS, ROUTES } from '../data/navigation';
import { PROFILE } from '../data/profile';
import { stagger } from './stagger';

interface SiteHeaderProps {
  menuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
}

const MENU_ID = 'menu-mobile';

export function SiteHeader({ menuOpen, onMenuToggle }: SiteHeaderProps) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (menuOpen) {
      menuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    } else if (wasOpen.current) {
      toggleRef.current?.focus();
    }
    wasOpen.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onMenuToggle(false);
      }
    };
    // Si la fenêtre repasse en largeur desktop, le menu mobile n'a plus lieu d'être ouvert.
    const desktop = window.matchMedia('(min-width: 960px)');
    const onDesktop = () => {
      if (desktop.matches) {
        onMenuToggle(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onDesktop);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onDesktop);
    };
  }, [menuOpen, onMenuToggle]);

  return (
    <header className={`site-header${menuOpen ? ' is-menu-open' : ''}`}>
      <div className="site-header__bar">
        <Link className="logo" to={ROUTES.home} aria-label={`${PROFILE.name}, retour à l'accueil`}>
          <span className="logo__name">MOUSSA</span>
          <span className="logo__role">{PROFILE.title}</span>
        </Link>

        <nav className="site-nav" aria-label="Navigation principale">
          <ul className="site-nav__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink className="site-nav__link" to={item.to}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <button
          ref={toggleRef}
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls={MENU_ID}
          onClick={() => onMenuToggle(!menuOpen)}
        >
          <span className="menu-toggle__label">{menuOpen ? 'Fermer' : 'Menu'}</span>
          <span className="menu-toggle__icon" aria-hidden="true" />
        </button>
      </div>

      <div ref={menuRef} id={MENU_ID} className="mobile-menu" hidden={!menuOpen}>
        <nav aria-label="Navigation mobile">
          <ol className="mobile-menu__list">
            {NAV_ITEMS.map((item, index) => (
              <li key={item.to} style={stagger(index)}>
                <NavLink className="mobile-menu__link" to={item.to}>
                  <span className="mobile-menu__number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>
        <p className="mobile-menu__foot">{PROFILE.baseline}</p>
      </div>
    </header>
  );
}
