import type { Project } from '../data/projects';

interface ProjectCoverProps {
  project: Project;
  number: string;
}

/** Visuel principal d'un projet, ou un fond stylisé tant que l'image n'a pas été fournie. */
export function ProjectCover({ project, number }: ProjectCoverProps) {
  if (project.cover) {
    return <img className="cover" src={project.cover.src} alt={project.cover.alt} />;
  }
  return (
    <div className="cover cover--empty" role="img" aria-label={`Visuel du projet ${project.name} à fournir`}>
      <span className="cover__number" aria-hidden="true">
        {number}
      </span>
      <span className="cover__missing" aria-hidden="true">
        Visuel à fournir
      </span>
    </div>
  );
}
