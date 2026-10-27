export const ROUTES = {
  intro: '/intro',
  home: '/accueil',
  projects: '/projets',
  about: '/a-propos',
  experience: '/parcours',
  training: '/entrainement',
  contact: '/contact',
} as const;

export function projectPath(slug: string): string {
  return `${ROUTES.projects}/${slug}`;
}

export interface NavItem {
  label: string;
  to: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', to: ROUTES.home },
  { label: 'Projets', to: ROUTES.projects },
  { label: 'À propos', to: ROUTES.about },
  { label: 'Parcours', to: ROUTES.experience },
  { label: 'Arène', to: ROUTES.training },
  { label: 'Contact', to: ROUTES.contact },
];

export interface TrainingModule {
  id: string;
  label: string;
  description: string;
  /** `true` quand le module est jouable dans l'arène. */
  available: boolean;
}

/** Modules présentés sur la page de l'arène. Seuls ceux marqués `available` sont jouables. */
export const TRAINING_MODULES: TrainingModule[] = [
  {
    id: 'bases',
    label: 'Mouvements de base',
    description: 'Garde, accroupi et parade, debout ou accroupie.',
    available: true,
  },
  {
    id: 'deplacements',
    label: 'Déplacements',
    description: 'Marche avant et arrière, au clavier, jusqu’à Shigaraki.',
    available: true,
  },
  {
    id: 'esquives',
    label: 'Esquives',
    description: 'Dash avant et arrière au double appui, et saut sur place, avant ou arrière.',
    available: true,
  },
  {
    id: 'combos',
    label: 'Combos',
    description: 'Léger, moyen, fort, puis coup de pied : chaque coup qui touche fait vaciller Shigaraki.',
    available: true,
  },
  {
    id: 'entrainement',
    label: 'Entraînement',
    description: 'Un mode libre pour essayer les mouvements, puis revenir au portfolio.',
    available: false,
  },
];
