/**
 * Textes de l'arène : écran de chargement (noms et astuces, repris de l'écran de chargement du lab) et aide des
 * touches. Le jeu lui-même (cinématique, barres, annonces) écrit ses propres textes, dans `../game/`.
 */

export interface LoadingFighter {
  name: string;
  title: string;
}

/** Les deux combattants de l'écran de chargement, tels que Moussa les a choisis pour le lab. */
export const LOADING_FIGHTERS: { hero: LoadingFighter; rival: LoadingFighter } = {
  hero: { name: 'Mouss', title: 'Combattant' },
  rival: { name: 'Shigaraki', title: 'Le boss final' },
};

/** Astuces affichées pendant le chargement, une à la fois. */
export const LOADING_TIPS: string[] = [
  'J enchaîne les coups : léger, moyen, fort, puis le coup de pied.',
  'L lance la boule de feu, I déclenche l’attaque finale, même en plein combo.',
  'Un coup touche ? Deux appuis rapides vers l’avant : drive rush, pour 2 blocs de drive.',
  'Maintiens Espace pour parer : chaque parade coûte un peu de drive.',
  'Deux appuis rapides sur une flèche font un dash.',
  'Shigaraki lit tes mouvements. Garde tes distances.',
];
