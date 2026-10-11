import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../components/Hud';
import { ProjectCover } from '../components/ProjectCover';
import { StageBackdrop } from '../components/StageBackdrop';
import { stagger } from '../components/stagger';
import { projectPath } from '../data/navigation';
import { PROJECTS, projectNumber } from '../data/projects';
import { usePageTitle } from '../hooks/usePageTitle';

const PREVIOUS_KEYS = ['ArrowLeft', 'ArrowUp'];
const NEXT_KEYS = ['ArrowRight', 'ArrowDown'];

export function Projects() {
  usePageTitle('Projets');
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);

  // Les flèches déplacent la sélection d'une carte à l'autre, comme sur un écran de sélection de combattants.
  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const current = cards.current.findIndex((card) => card === document.activeElement);
    if (current === -1) {
      return;
    }
    let target = current;
    if (NEXT_KEYS.includes(event.key)) {
      target = (current + 1) % PROJECTS.length;
    } else if (PREVIOUS_KEYS.includes(event.key)) {
      target = (current - 1 + PROJECTS.length) % PROJECTS.length;
    } else if (event.key === 'Home') {
      target = 0;
    } else if (event.key === 'End') {
      target = PROJECTS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    cards.current[target]?.focus();
  };

  return (
    <div className="page page--select">
      <StageBackdrop focus="plaza" dim="heavy" fixed />
      <div className="page__inner page__inner--wide">
        <PageHead
          eyebrow="Sélection · 3 projets"
          title="Choisis ton projet"
          lead="Trois projets, trois études de cas. Choisis une carte pour l’ouvrir."
        />

        <ol className="select" onKeyDown={onKeyDown}>
          {PROJECTS.map((project, index) => {
            const number = projectNumber(project.slug);
            return (
              <li key={project.slug} className="select__item rise" style={stagger(index + 2)}>
                <Link
                  ref={(element) => {
                    cards.current[index] = element;
                  }}
                  className="pcard"
                  to={projectPath(project.slug)}
                >
                  <div className="pcard__media">
                    <ProjectCover project={project} number={number} />
                  </div>
                  <span className="pcard__number" aria-hidden="true">
                    {number}
                  </span>
                  <div className="pcard__body">
                    <p className="pcard__category">{project.category}</p>
                    <h2 className="pcard__name">{project.name}</h2>
                    <p className="pcard__summary">{project.summary}</p>
                    <span className="btn btn--primary btn--small pcard__cta">
                      <span className="btn__label">Voir le projet</span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
