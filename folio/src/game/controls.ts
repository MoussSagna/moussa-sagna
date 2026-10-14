/**
 * Clés du registre Phaser par lesquelles l'interface React transmet les commandes des boutons à la scène.
 * Le clavier, lui, est lu directement par la scène (`input.ts`).
 */
export const CONTROLS = {
  /** Déplacement demandé : 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt. */
  walk: 'walk',
  /** Vrai tant que le personnage doit rester accroupi. */
  crouch: 'crouch',
  /** Vrai tant que le personnage doit parer. */
  block: 'block',
  /** Compteur : chaque changement de valeur lance un saut. */
  jump: 'jump',
  /** Compteur : chaque changement de valeur est un appui sur la touche d'attaque. */
  attack: 'attack',
  /** Compteur : chaque changement de valeur passe les plans de la cinématique d'entrée. */
  skipCinematic: 'skipCinematic',
  /** Compteur : chaque changement de valeur rejoue la cinématique d'entrée. */
  replayCinematic: 'replayCinematic',
} as const;
