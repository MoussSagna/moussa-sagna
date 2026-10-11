import { ArcadeLink } from '../components/ArcadeButton';
import { StageBackdrop } from '../components/StageBackdrop';
import { ROUTES } from '../data/navigation';
import { usePageTitle } from '../hooks/usePageTitle';

interface NotFoundProps {
  message?: string;
}

export function NotFound({ message = 'Cette page n’existe pas ou a été déplacée.' }: NotFoundProps) {
  usePageTitle('Page introuvable');
  return (
    <div className="page page--centered">
      <StageBackdrop focus="moon" dim="heavy" fixed />
      <div className="page__inner notfound">
        <p className="eyebrow rise">Erreur 404</p>
        <h1 className="display notfound__title rise" style={{ animationDelay: '80ms' }}>
          Hors du ring
        </h1>
        <p className="notfound__text rise" style={{ animationDelay: '160ms' }}>
          {message}
        </p>
        <div className="actions actions--center rise" style={{ animationDelay: '240ms' }}>
          <ArcadeLink to={ROUTES.home}>Retour à l’accueil</ArcadeLink>
          <ArcadeLink to={ROUTES.projects} variant="secondary">
            Voir les projets
          </ArcadeLink>
        </div>
      </div>
    </div>
  );
}
