import { ArcadeLink } from '../components/ArcadeButton';
import { HudPanel, PageHead, Pending } from '../components/Hud';
import { Reveal } from '../components/Reveal';
import { StageBackdrop } from '../components/StageBackdrop';
import { EXPERIENCE } from '../data/experience';
import { ROUTES } from '../data/navigation';
import { usePageTitle } from '../hooks/usePageTitle';

export function Experience() {
  usePageTitle('Parcours');
  return (
    <div className="page">
      <StageBackdrop focus="right" dim="heavy" fixed />
      <div className="page__inner page__inner--narrow">
        <PageHead eyebrow="Parcours · 2017 – 2025" title="Expérience" lead="Du webdesign à l’UI/UX design, du plus récent au plus ancien." />

        <ol className="timeline">
          {EXPERIENCE.map((entry) => (
            <li key={entry.period} className="timeline__item">
              <Reveal>
                <p className="timeline__period">{entry.period}</p>
                <HudPanel>
                  {entry.company ? (
                    <h2 className="timeline__company">{entry.company}</h2>
                  ) : (
                    <h2 className="timeline__company timeline__company--missing">Expérience à préciser</h2>
                  )}
                  {entry.role ? (
                    <p className="timeline__role">{entry.role}</p>
                  ) : (
                    <Pending>Entreprise et poste occupé sur cette période.</Pending>
                  )}
                  {entry.missions ? (
                    <p className="timeline__missions">{entry.missions}</p>
                  ) : (
                    <Pending>Description des missions.</Pending>
                  )}
                  {entry.skills.length > 0 ? (
                    <ul className="tags">
                      {entry.skills.map((skill) => (
                        <li key={skill} className="tag">
                          {skill}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Pending>Compétences associées.</Pending>
                  )}
                </HudPanel>
              </Reveal>
            </li>
          ))}
        </ol>

        <div className="actions">
          <ArcadeLink to={ROUTES.projects}>Voir les projets</ArcadeLink>
          <ArcadeLink to={ROUTES.contact} variant="secondary">
            Me contacter
          </ArcadeLink>
        </div>
      </div>
    </div>
  );
}
