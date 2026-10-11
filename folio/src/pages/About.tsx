import { ArcadeLink } from '../components/ArcadeButton';
import { FighterPortrait } from '../components/FighterPortrait';
import { HudPanel, PageHead, Pending } from '../components/Hud';
import { Reveal } from '../components/Reveal';
import { StageBackdrop } from '../components/StageBackdrop';
import { FIGHTERS, fighterArtUrl } from '../data/fighters';
import { ROUTES } from '../data/navigation';
import { PROFILE, SKILL_PANELS } from '../data/profile';
import { usePageTitle } from '../hooks/usePageTitle';

export function About() {
  usePageTitle('À propos');
  const { moussa } = FIGHTERS;
  return (
    <div className="page">
      <StageBackdrop focus="left" dim="heavy" fixed />
      <div className="page__inner">
        <div className="about">
          <div className="about__portrait rise">
            <FighterPortrait fighter={moussa} variant="profile" showTag />
            {moussa.expressions.length > 0 && (
              <ul className="expressions" aria-label={`Expressions de ${moussa.name}`}>
                {moussa.expressions.map((expression, index) => (
                  <li key={expression.src}>
                    <img
                      src={fighterArtUrl(expression)}
                      width={expression.width}
                      height={expression.height}
                      alt={`Expression ${index + 1} de ${moussa.name}`}
                      loading="lazy"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="about__intro">
            <PageHead eyebrow={`Profil · ${PROFILE.title}`} title="À propos" />
            {PROFILE.intro.map((paragraph) => (
              <p key={paragraph} className="about__text">
                {paragraph}
              </p>
            ))}
            <h2 className="subhead">Spécialités</h2>
            <ul className="tags">
              {PROFILE.specialties.map((specialty) => (
                <li key={specialty} className="tag tag--strong">
                  {specialty}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Reveal>
          <section aria-labelledby="competences">
            <h2 id="competences" className="section-title">
              Compétences et outils
            </h2>
            <div className="skills">
              {SKILL_PANELS.map((panel, index) => (
                <HudPanel key={panel.id} label={`0${index + 1} · ${panel.label}`} accent={index === 1 ? 'violet' : 'red'}>
                  <ul className="skills__list">
                    {panel.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {panel.pending && <Pending>{panel.pending}</Pending>}
                </HudPanel>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <blockquote className="quote">
            <p>{PROFILE.quote}</p>
          </blockquote>
        </Reveal>

        <div className="actions">
          <ArcadeLink to={ROUTES.experience}>Voir le parcours</ArcadeLink>
          <ArcadeLink to={ROUTES.contact} variant="secondary">
            Me contacter
          </ArcadeLink>
        </div>
      </div>
    </div>
  );
}
