import { STAGE_BACKGROUND_URL } from '../assets';

export interface ProjectImage {
  src: string;
  alt: string;
}

export interface ProjectLink {
  label: string;
  url: string;
}

/**
 * Un champ à `null` (ou une liste vide) signifie « contenu à fournir » :
 * la page de détail affiche alors un encart « À compléter » au lieu d'inventer un texte.
 */
export interface Project {
  slug: string;
  name: string;
  category: string;
  summary: string;
  cover: ProjectImage | null;
  role: string | null;
  year: string | null;
  context: string | null;
  problem: string | null;
  objectives: string[];
  approach: string | null;
  solutions: string[];
  gallery: ProjectImage[];
  technologies: string[];
  links: ProjectLink[];
}

export const PROJECTS: Project[] = [
  {
    slug: 'racine-eyewear',
    name: 'RACINE EYEWEAR',
    category: 'Site vitrine · Branding · Animation',
    summary: 'Site vitrine, branding et animation.',
    cover: null,
    role: null,
    year: null,
    context: null,
    problem: null,
    objectives: [],
    approach: null,
    solutions: [],
    gallery: [],
    technologies: [],
    links: [],
  },
  {
    slug: 'tokyo-underground',
    name: 'TOKYO UNDERGROUND',
    category: 'Portfolio · Expérience interactive',
    summary: 'Ce portfolio : une interface pensée comme un jeu de combat 2D, dans un Tokyo nocturne sous la pluie.',
    cover: {
      src: STAGE_BACKGROUND_URL,
      alt: 'Décor Tokyo Underground : place mouillée, cerisier en fleurs et lune rouge au-dessus de la ville.',
    },
    role: 'Design et développement',
    year: '2026',
    context:
      'Tokyo Underground est le portfolio de Moussa. Il présente son profil et ses projets dans une expérience ' +
      "inspirée de l'énergie visuelle des jeux de combat 2D : mise en scène, interface d'arcade, typographie " +
      'expressive et ambiance cyberpunk japonaise.',
    problem:
      "Donner l'impression de naviguer dans un jeu de combat tout en gardant un vrai portfolio : des textes " +
      'lisibles, des projets accessibles et une navigation claire.',
    objectives: [
      'Présenter les projets comme une sélection de combattants.',
      'Garder des études de cas lisibles et professionnelles.',
      'Avancer par paliers, sans construire un jeu complet avant d’avoir un portfolio utilisable.',
    ],
    approach:
      "Le projet avance par étapes validées séparément : d'abord le socle technique et l'arène, puis l'interface " +
      'du portfolio, et seulement ensuite la présence du personnage et une mini-expérience jouable.',
    solutions: [
      'Arène rendue en WebGL avec Phaser, en résolution logique 1280 × 720.',
      'Interface du portfolio en React, séparée du moteur de jeu.',
      'Design system maison : palette néon, panneaux HUD et typographie d’affiche de combat.',
    ],
    gallery: [
      {
        src: STAGE_BACKGROUND_URL,
        alt: 'Le stage Tokyo Underground, décor signature du portfolio.',
      },
    ],
    technologies: ['TypeScript', 'React', 'Phaser 3', 'Vite', 'CSS'],
    links: [],
  },
  {
    slug: 'boxing-club-de-la-plaine',
    name: 'BOXING CLUB DE LA PLAINE',
    category: 'Site web · Expérience utilisateur',
    summary: 'Site web et expérience utilisateur.',
    cover: null,
    role: null,
    year: null,
    context: null,
    problem: null,
    objectives: [],
    approach: null,
    solutions: [],
    gallery: [],
    technologies: [],
    links: [],
  },
];

export function findProject(slug: string | undefined, projects: Project[] = PROJECTS): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

/** Numéro d'affichage du projet, sur deux chiffres (« 01 », « 02 »…). */
export function projectNumber(slug: string, projects: Project[] = PROJECTS): string {
  const index = projects.findIndex((project) => project.slug === slug);
  return String(index + 1).padStart(2, '0');
}

/** Projets précédent et suivant, en boucle sur la liste. */
export function adjacentProjects(
  slug: string,
  projects: Project[] = PROJECTS,
): { previous: Project; next: Project } | undefined {
  const index = projects.findIndex((project) => project.slug === slug);
  const previous = projects[(index - 1 + projects.length) % projects.length];
  const next = projects[(index + 1) % projects.length];
  if (index === -1 || !previous || !next) {
    return undefined;
  }
  return { previous, next };
}
