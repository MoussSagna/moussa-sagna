import type { CinematicTexts } from '../game/cinematic/cinematic';
import { PROFILE } from './profile';

/**
 * Textes de la cinématique d'entrée de l'arène : cartons de nom des deux personnages, puis annonces avant le
 * combat. L'adversaire n'a pas encore de nom : son carton garde un point d'interrogation.
 */
export const CINEMATIC_TEXTS: CinematicTexts = {
  hero: { title: PROFILE.name.toUpperCase(), subtitle: PROFILE.title.toUpperCase() },
  rival: { title: '???', subtitle: 'LE BOSS FINAL' },
  destiny: 'FACE YOUR DESTINY',
  round: (round) => `ROUND ${round}`,
  fight: 'FIGHT!',
};
