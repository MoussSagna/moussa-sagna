import type { CinematicTexts } from '../game/cinematic/cinematic';
import { FIGHTERS } from './fighters';
import { PROFILE } from './profile';

/**
 * Textes de la cinématique d'entrée de l'arène : cartons de nom des deux personnages, puis annonces avant le
 * combat.
 */
export const CINEMATIC_TEXTS: CinematicTexts = {
  hero: { title: PROFILE.name.toUpperCase(), subtitle: PROFILE.title.toUpperCase() },
  rival: { title: FIGHTERS.challenger.name.toUpperCase(), subtitle: FIGHTERS.challenger.tagline.toUpperCase() },
  destiny: 'FACE YOUR DESTINY',
  round: (round) => `ROUND ${round}`,
  fight: 'FIGHT!',
};
