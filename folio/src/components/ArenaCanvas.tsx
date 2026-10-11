import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createArenaGame } from '../game/config';
import { WALK_REGISTRY_KEY } from '../game/controls';

interface ArenaCanvasProps {
  /** Déplacement demandé par les boutons de la page : 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt. */
  walk?: number;
}

/**
 * Pont entre React et Phaser : monte l'arène dans un conteneur dédié.
 * Le moteur n'est créé qu'au montage et détruit au démontage ; `walk` lui est transmis par son registre,
 * sans le recréer.
 */
export default function ArenaCanvas({ walk = 0 }: ArenaCanvasProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) {
      return;
    }
    const game = createArenaGame(parent);
    gameRef.current = game;
    return () => {
      gameRef.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    gameRef.current?.registry.set(WALK_REGISTRY_KEY, walk);
  }, [walk]);

  return (
    <div
      ref={parentRef}
      className="arena-canvas"
      role="img"
      aria-label="Arène Tokyo Underground : cour de temple sous la pluie, lune rouge, cerisier en fleurs et ville au néon. Moussa s'y tient en garde, peut marcher et dasher."
    />
  );
}
