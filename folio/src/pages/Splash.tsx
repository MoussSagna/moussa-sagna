import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FighterPortrait } from '../components/FighterPortrait';
import { Petals } from '../components/Petals';
import { StageBackdrop } from '../components/StageBackdrop';
import { FIGHTERS } from '../data/fighters';
import { ROUTES } from '../data/navigation';
import { PROFILE } from '../data/profile';
import { markIntroSeen } from '../hooks/introSeen';
import { usePageTitle } from '../hooks/usePageTitle';

/** Touches qui ne doivent pas lancer le portfolio : navigation au clavier et raccourcis du navigateur. */
const IGNORED_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape']);

export function Splash() {
  usePageTitle();
  const navigate = useNavigate();
  const started = useRef(false);

  const start = useCallback(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    markIntroSeen();
    navigate(ROUTES.home);
  }, [navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || IGNORED_KEYS.has(event.key) || /^F\d+$/.test(event.key)) {
        return;
      }
      start();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [start]);

  return (
    // Le clic n'importe où est un raccourci ; les boutons ci-dessous restent le chemin accessible au clavier.
    <div className="splash" onClick={start}>
      <StageBackdrop focus="moon" dim="heavy" />
      <div className="splash__side splash__side--p1" aria-hidden="true" />
      <div className="splash__side splash__side--cpu" aria-hidden="true" />
      <Petals />

      <button className="splash__skip" type="button" onClick={start}>
        Passer l’intro
      </button>

      <main className="splash__content">
        <header className="splash__head">
          <h1 className="display splash__title">Tokyo Underground</h1>
          <p className="eyebrow splash__baseline">{PROFILE.baseline}</p>
        </header>

        <div className="splash__versus">
          <div className="splash__fighter splash__fighter--p1">
            <FighterPortrait fighter={FIGHTERS.moussa} variant="splash" showTag />
          </div>
          <p className="splash__vs" aria-label="Moussa contre Shigaraki">
            <span aria-hidden="true">VS</span>
          </p>
          <div className="splash__fighter splash__fighter--cpu">
            <FighterPortrait fighter={FIGHTERS.challenger} variant="splash" showTag />
          </div>
        </div>

        <div className="splash__start">
          <button className="splash__press" type="button" onClick={start} autoFocus>
            Appuyez pour commencer
          </button>
          <p className="splash__hint">Clic, toucher ou n’importe quelle touche</p>
        </div>
      </main>
    </div>
  );
}
