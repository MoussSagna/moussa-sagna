import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalAction } from '../components/ArcadeButton';
import { Pending } from '../components/Hud';
import { ProjectCover } from '../components/ProjectCover';
import { Reveal } from '../components/Reveal';
import { ROUTES, projectPath } from '../data/navigation';
import { adjacentProjects, findProject, projectNumber } from '../data/projects';
import { usePageTitle } from '../hooks/usePageTitle';
import { NotFound } from './NotFound';

interface CaseSectionProps {
  index: number;
  title: string;
  children: ReactNode;
}

function CaseSection({ index, title, children }: CaseSectionProps) {
  return (
    <Reveal>
      <section className="case-section">
        <h2 className="case-section__title">
          <span className="case-section__index" aria-hidden="true">
            {String(index).padStart(2, '0')}
          </span>
          {title}
        </h2>
        <div className="case-section__body">{children}</div>
      </section>
    </Reveal>
  );
}

function Paragraph({ text, missing }: { text: string | null; missing: string }) {
  return text ? <p>{text}</p> : <Pending>{missing}</Pending>;
}

function BulletList({ items, missing }: { items: string[]; missing: string }) {
  if (items.length === 0) {
    return <Pending>{missing}</Pending>;
  }
  return (
    <ul className="bullets">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function ProjectDetail() {
  const { slug } = useParams();
  const project = findProject(slug);
  usePageTitle(project?.name ?? 'Projet introuvable');

  const adjacent = project ? adjacentProjects(project.slug) : undefined;
  if (!project || !adjacent) {
    return <NotFound message="Ce projet n’existe pas ou a été déplacé." />;
  }
  const number = projectNumber(project.slug);

  return (
    <article className="case">
      <header className="case-hero">
        <div className="case-hero__media">
          <ProjectCover project={project} number={number} />
        </div>
        <div className="case-hero__content">
          <Link className="back-link rise" to={ROUTES.projects}>
            Retour à la sélection
          </Link>
          <p className="eyebrow rise" style={{ animationDelay: '80ms' }}>
            Projet {number} · {project.category}
          </p>
          <h1 className="display case-hero__title rise" style={{ animationDelay: '160ms' }}>
            {project.name}
          </h1>
        </div>
      </header>

      <div className="case__inner">
        <p className="case__summary">{project.summary}</p>

        <dl className="case-meta">
          <div>
            <dt>Rôle</dt>
            <dd>{project.role ?? <span className="case-meta__missing">À compléter</span>}</dd>
          </div>
          <div>
            <dt>Année</dt>
            <dd>{project.year ?? <span className="case-meta__missing">À compléter</span>}</dd>
          </div>
          <div>
            <dt>Catégorie</dt>
            <dd>{project.category}</dd>
          </div>
        </dl>

        <CaseSection index={1} title="Contexte">
          <Paragraph text={project.context} missing="Le contexte du projet : client, besoin de départ, équipe." />
        </CaseSection>
        <CaseSection index={2} title="Problématique">
          <Paragraph text={project.problem} missing="La problématique à laquelle le projet répond." />
        </CaseSection>
        <CaseSection index={3} title="Objectifs">
          <BulletList items={project.objectives} missing="Les objectifs fixés pour le projet." />
        </CaseSection>
        <CaseSection index={4} title="Démarche">
          <Paragraph text={project.approach} missing="Les étapes de travail, de la recherche à la livraison." />
        </CaseSection>
        <CaseSection index={5} title="Solutions réalisées">
          <BulletList items={project.solutions} missing="Ce qui a été conçu et livré." />
        </CaseSection>

        <CaseSection index={6} title="Galerie">
          {project.gallery.length > 0 ? (
            <ul className="gallery">
              {project.gallery.map((image) => (
                <li key={image.src}>
                  <img src={image.src} alt={image.alt} loading="lazy" />
                </li>
              ))}
            </ul>
          ) : (
            <Pending>Les visuels du projet : maquettes, captures d’écran, photos.</Pending>
          )}
        </CaseSection>

        <CaseSection index={7} title="Technologies et outils">
          {project.technologies.length > 0 ? (
            <ul className="tags">
              {project.technologies.map((technology) => (
                <li key={technology} className="tag">
                  {technology}
                </li>
              ))}
            </ul>
          ) : (
            <Pending>Les technologies et outils utilisés.</Pending>
          )}
        </CaseSection>

        <CaseSection index={8} title="Liens">
          {project.links.length > 0 ? (
            <div className="actions">
              {project.links.map((link) => (
                <ExternalAction key={link.url} href={link.url} label={link.label} missingLabel={link.label} />
              ))}
            </div>
          ) : (
            <Pending>L’adresse du site en ligne ou du dépôt, si elle peut être partagée.</Pending>
          )}
        </CaseSection>

        <nav className="case-nav" aria-label="Autres projets">
          <Link className="case-nav__link case-nav__link--previous" to={projectPath(adjacent.previous.slug)}>
            <span className="case-nav__direction">Projet précédent</span>
            <span className="case-nav__name">{adjacent.previous.name}</span>
          </Link>
          <Link className="case-nav__link case-nav__link--next" to={projectPath(adjacent.next.slug)}>
            <span className="case-nav__direction">Projet suivant</span>
            <span className="case-nav__name">{adjacent.next.name}</span>
          </Link>
        </nav>

        <p className="case__back">
          <Link className="back-link" to={ROUTES.projects}>
            Retour à la sélection des projets
          </Link>
        </p>
      </div>
    </article>
  );
}
