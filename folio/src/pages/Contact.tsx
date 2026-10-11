import { ArcadeLink, ExternalAction } from '../components/ArcadeButton';
import { HudPanel, Pending } from '../components/Hud';
import { StageBackdrop } from '../components/StageBackdrop';
import { ROUTES } from '../data/navigation';
import { CONTACT } from '../data/profile';
import { usePageTitle } from '../hooks/usePageTitle';

export function Contact() {
  usePageTitle('Contact');
  const hasMissingLink = !CONTACT.email || !CONTACT.linkedin || !CONTACT.github;

  return (
    <div className="page page--centered">
      <StageBackdrop focus="plaza" dim="medium" fixed />
      <div className="page__inner contact">
        <p className="eyebrow rise">Nouveau challenger</p>
        <h1 className="display contact__title rise" style={{ animationDelay: '80ms' }}>
          Contact
        </h1>
        <p className="contact__lead rise" style={{ animationDelay: '160ms' }}>
          Un projet, une idée, une collaboration ? Parlons-en.
        </p>

        <HudPanel className="contact__panel rise">
          <div className="contact__actions">
            <ExternalAction
              href={CONTACT.email ? `mailto:${CONTACT.email}` : null}
              label="Envoyer un e-mail"
              missingLabel="E-mail indisponible"
              variant="primary"
            />
            <ExternalAction href={CONTACT.linkedin} label="LinkedIn" missingLabel="LinkedIn indisponible" />
            <ExternalAction href={CONTACT.github} label="GitHub" missingLabel="GitHub indisponible" />
          </div>
          {hasMissingLink && <Pending>Les coordonnées manquantes seront ajoutées prochainement.</Pending>}
        </HudPanel>

        <p className="contact__back">
          <ArcadeLink to={ROUTES.home} variant="secondary">
            Retour à l’accueil
          </ArcadeLink>
        </p>
      </div>
    </div>
  );
}
