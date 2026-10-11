export const PROFILE = {
  name: 'Moussa',
  title: 'Creative Developer',
  baseline: 'Creative Developer / Portfolio',
  intro: [
    'Moussa est Creative Developer. Il vient du design : UI/UX Designer à la SACEM, puis webdesigner pour ' +
      'SONOFSNEAKERS et l’association Team Trail Ouzbek.',
    'Aujourd’hui il réunit design et code dans des interfaces mises en scène, comme ce portfolio pensé comme ' +
      'un jeu de combat 2D.',
  ],
  /** Proposition de rédaction, à valider ou remplacer par Moussa. */
  quote: 'Je conçois une interface comme un stage de jeu de combat : chaque détail sert la lisibilité et l’impact.',
  specialties: ['UI/UX Design', 'Webdesign', 'Développement créatif', 'Branding et animation'],
};

export interface SkillPanel {
  id: string;
  label: string;
  /** Compétences confirmées par le contexte du projet ou par le code de ce portfolio. */
  items: string[];
  /** Ce qui reste à confirmer par Moussa ; `null` si rien n'est en attente. */
  pending: string | null;
}

export const SKILL_PANELS: SkillPanel[] = [
  {
    id: 'design',
    label: 'Design',
    items: ['UI Design', 'UX Design', 'Webdesign', 'Branding'],
    pending: 'Outils de design utilisés',
  },
  {
    id: 'code',
    label: 'Code',
    items: ['TypeScript', 'React', 'HTML et CSS', 'Vite'],
    pending: 'Autres langages et frameworks',
  },
  {
    id: 'interactif',
    label: 'Interactif',
    items: ['Phaser 3', 'Rendu WebGL', 'Animation d’interface'],
    pending: 'Outils de motion design',
  },
];

/** `null` tant que la coordonnée n'a pas été fournie : le lien est alors affiché comme indisponible. */
export interface ContactInfo {
  email: string | null;
  linkedin: string | null;
  github: string | null;
}

export const CONTACT: ContactInfo = {
  email: null,
  linkedin: null,
  github: null,
};
