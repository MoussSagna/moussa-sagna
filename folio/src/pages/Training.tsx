import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { ArcadeLink } from '../components/ArcadeButton';
import { HudPanel, PageHead } from '../components/Hud';
import { Reveal } from '../components/Reveal';
import { ROUTES, TRAINING_MODULES } from '../data/navigation';
import { leavesKeyAlone } from '@game/controls';
import { usePageTitle } from '../hooks/usePageTitle';

// Le moteur du jeu n'est téléchargé que sur cette page : le reste du portfolio n'en dépend pas.
const GameArena = lazy(() => import('../components/GameArena'));

/** Vrai si le navigateur sait mettre un élément en plein écran (pas l'iPhone, par exemple). */
const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

/**
 * Plein écran de l'arène : le bouton dans un coin de l'écran de jeu, ou la touche F. Le jeu y garde son format
 * 16:9, centré sur fond noir ; Échap ou un nouvel appui en sort.
 */
function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === target.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [target]);
  const toggle = useCallback(() => {
    const element = target.current;
    if (!element || !canFullscreen) {
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen().catch(() => undefined);
    }
  }, [target]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.repeat || leavesKeyAlone(event)) {
        return;
      }
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);
  return { active, toggle };
}

export function Training() {
  usePageTitle('Arène · Mode entraînement');
  const screen = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(screen);
  return (
    <div className="page page--training">
      <div className="page__inner">
        <PageHead
          eyebrow="Arène · Mode entraînement"
          title="Premiers pas dans l’arène"
          lead="Une cinématique présente Moussa et Shigaraki, puis le combat commence, rendu en temps réel ci-dessous et jouable au clavier, en plein écran si tu veux. Enchaîne les coups, annule-les en drive rush, place l’attaque finale en plein combo, et mets Shigaraki K.O."
        />

        <figure className="arena-frame rise" style={{ animationDelay: '240ms' }}>
          <div className="arena-frame__screen" ref={screen}>
            <Suspense fallback={<p className="arena-frame__loading">Chargement de l’arène…</p>}>
              <GameArena />
            </Suspense>
            {canFullscreen && (
              <button
                type="button"
                className="arena-frame__fullscreen"
                onClick={(event) => {
                  // le bouton rend le focus : les touches du jeu ne doivent pas rappuyer sur le bouton
                  event.currentTarget.blur();
                  fullscreen.toggle();
                }}
                aria-pressed={fullscreen.active}
                title={fullscreen.active ? 'Quitter le plein écran (F)' : 'Plein écran (F)'}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  {fullscreen.active ? (
                    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                  ) : (
                    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                  )}
                </svg>
                <span className="sr-only">{fullscreen.active ? 'Quitter le plein écran' : 'Plein écran'}</span>
              </button>
            )}
          </div>
          <figcaption className="arena-frame__caption">
            <span className="status">Jouable</span>
            <span>Stage 01 · Tokyo Underground · rendu WebGL</span>
          </figcaption>
          <p className="arena-hint">
            Maintiens <kbd>←</kbd> <kbd>→</kbd> ou <kbd>Q</kbd> <kbd>D</kbd> pour marcher, appuie deux fois vite pour un
            dash. Maintiens <kbd>↓</kbd> ou <kbd>S</kbd> pour t’accroupir. Pour parer, tiens l’arrière quand Shigaraki attaque (avec le bas : parade accroupie). <kbd>↑</kbd> ou{' '}
            <kbd>Z</kbd> pour sauter (avec <kbd>←</kbd> ou <kbd>→</kbd> maintenu : saut arrière ou avant), <kbd>J</kbd>{' '}
            pour attaquer : un appui pour le coup léger, puis un par coup pour enchaîner le moyen, le fort et le coup de
            pied. Pendant un coup qui touche, deux appuis vite vers l’avant lancent un drive rush (2 blocs de drive).{' '}
            <kbd>L</kbd> lance la boule de feu, <kbd>I</kbd> l’attaque finale. <kbd>Échap</kbd> passe l’intro,{' '}
            <kbd>F</kbd> met l’arène en plein écran.
          </p>
        </figure>

        <Reveal>
          <section aria-labelledby="modules">
            <h2 id="modules" className="section-title">
              Modules
            </h2>
            <ul className="modules">
              {TRAINING_MODULES.map((module, index) => (
                <li key={module.id}>
                  <HudPanel label={`Module 0${index + 1}`} accent="violet" className="module">
                    <h3 className="module__title">{module.label}</h3>
                    <p className="module__text">{module.description}</p>
                    {module.available ? (
                      <p className="status">Disponible</p>
                    ) : (
                      <p className="status status--soon">Bientôt disponible</p>
                    )}
                  </HudPanel>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <div className="actions">
          <ArcadeLink to={ROUTES.projects}>Voir les projets</ArcadeLink>
          <ArcadeLink to={ROUTES.home} variant="secondary">
            Retour à l’accueil
          </ArcadeLink>
        </div>
      </div>
    </div>
  );
}
