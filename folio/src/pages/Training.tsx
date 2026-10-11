import { Suspense, lazy, useState } from 'react';
import { ArcadeLink } from '../components/ArcadeButton';
import { HudPanel, PageHead } from '../components/Hud';
import { Reveal } from '../components/Reveal';
import { ROUTES, TRAINING_MODULES } from '../data/navigation';
import { usePageTitle } from '../hooks/usePageTitle';

// Phaser n'est téléchargé que sur cette page : le reste du portfolio n'en dépend pas.
const ArenaCanvas = lazy(() => import('../components/ArenaCanvas'));

/** Bouton à maintenir : la marche dure tant que le doigt, la souris ou la touche reste appuyé. */
function HoldButton({ label, onHold }: { label: string; onHold: (held: boolean) => void }) {
  return (
    <button
      type="button"
      className="btn btn--secondary btn--small arena-controls__button"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          onHold(true);
        }
      }}
      onKeyUp={() => onHold(false)}
      onBlur={() => onHold(false)}
    >
      <span className="btn__label">{label}</span>
    </button>
  );
}

export function Training() {
  usePageTitle('Arène · Mode entraînement');
  const [walk, setWalk] = useState(0);
  return (
    <div className="page page--training">
      <div className="page__inner">
        <PageHead
          eyebrow="Arène · Mode entraînement"
          title="Premiers pas dans l’arène"
          lead="Moussa se tient en garde dans l’arène, rendue en temps réel ci-dessous. Il marche et il dashe. Le reste du mode entraînement (sauts, coups, adversaire) n’est pas encore développé."
        />

        <figure className="arena-frame rise" style={{ animationDelay: '240ms' }}>
          <div className="arena-frame__screen">
            <Suspense fallback={<p className="arena-frame__loading">Chargement de l’arène…</p>}>
              <ArenaCanvas walk={walk} />
            </Suspense>
          </div>
          <figcaption className="arena-frame__caption">
            <span className="status">Jouable · marche et dash</span>
            <span>Stage 01 · Tokyo Underground · rendu Phaser</span>
          </figcaption>
          <div className="arena-controls">
            <HoldButton label="Reculer" onHold={(held) => setWalk(held ? -1 : 0)} />
            <HoldButton label="Avancer" onHold={(held) => setWalk(held ? 1 : 0)} />
            <p className="arena-controls__hint">
              Maintiens <kbd>←</kbd> <kbd>→</kbd> ou <kbd>Q</kbd> <kbd>D</kbd> pour marcher, appuie deux fois vite pour un dash.
            </p>
          </div>
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
