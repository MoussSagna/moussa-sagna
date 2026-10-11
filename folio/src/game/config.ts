import Phaser from 'phaser';
import { ArenaScene } from './scenes/ArenaScene';

/** Résolution logique de référence : toutes les coordonnées de scène s'expriment dans cet espace. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

const gameConfig: Phaser.Types.Core.GameConfig = {
  // AUTO sélectionne WebGL lorsqu'il est disponible et ne retombe sur Canvas qu'en dernier recours.
  type: Phaser.AUTO,
  backgroundColor: '#070b12',
  // Mipmaps pour les atlas du personnage (2048 × 2048), affichés environ quatre fois plus petits.
  render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
  scale: {
    // FIT conserve le ratio 16:9 à l'intérieur de l'élément parent.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [ArenaScene],
};

/** Crée l'instance Phaser de l'arène dans l'élément fourni. L'appelant est responsable de sa destruction. */
export function createArenaGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({ ...gameConfig, parent });
}
