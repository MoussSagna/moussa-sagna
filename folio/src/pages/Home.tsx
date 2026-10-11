import { ArcadeLink } from '../components/ArcadeButton';
import { FighterPortrait } from '../components/FighterPortrait';
import { Petals } from '../components/Petals';
import { StageBackdrop } from '../components/StageBackdrop';
import { stagger } from '../components/stagger';
import { FIGHTERS } from '../data/fighters';
import { ROUTES } from '../data/navigation';
import { PROFILE } from '../data/profile';
import { usePageTitle } from '../hooks/usePageTitle';

export function Home() {
  usePageTitle('Accueil');
  const { moussa, challenger } = FIGHTERS;

  return (
    <div className="home">
      <StageBackdrop focus="moon" dim="light" />
      <Petals />

      <div className="home__stage">
        <div className="home__fighter home__fighter--p1 rise" style={stagger(2)}>
          <FighterPortrait fighter={moussa} variant="hero" />
        </div>

        <div className="home__center">
          <p className="eyebrow rise">Stage 01 · Mode arcade</p>
          <h1 className="display home__title rise" style={stagger(1)}>
            <span>Tokyo</span> <span>Underground</span>
          </h1>
          <p className="home__baseline rise" style={stagger(2)}>
            {PROFILE.baseline}
          </p>
          <div className="home__actions rise" style={stagger(3)}>
            <ArcadeLink to={ROUTES.training}>Entrer dans l’arène</ArcadeLink>
            <ArcadeLink to={ROUTES.projects} variant="secondary">
              Voir les projets
            </ArcadeLink>
          </div>
        </div>

        <div className="home__fighter home__fighter--cpu rise" style={stagger(3)}>
          <FighterPortrait fighter={challenger} variant="rival" />
        </div>
      </div>

      {/* Bandeau d'habillage : les jauges sont décoratives et ne mesurent rien. */}
      <div className="home__hud">
        <div className="home-hud home-hud--p1">
          <span className="home-hud__slot">{moussa.slot}</span>
          <span className="home-hud__name">{moussa.name}</span>
          <span className="home-hud__gauge" aria-hidden="true" />
        </div>
        <p className="home-hud__center">
          <span className="home-hud__vs" aria-hidden="true">
            VS
          </span>
          <span className="home-hud__stage">Tokyo · Nuit · Pluie</span>
        </p>
        <div className="home-hud home-hud--cpu">
          <span className="home-hud__slot">{challenger.slot}</span>
          <span className="home-hud__name">{challenger.name}</span>
          <span className="home-hud__gauge" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
