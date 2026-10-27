import { useEffect, useRef } from 'react';
import { createArenaGame } from '../game/config';

/**
 * Pont entre React et Phaser : monte l'arène dans un conteneur dédié. Le moteur n'est créé qu'au montage et
 * détruit au démontage. L'arène se joue au clavier, lu par la scène elle-même.
 */
export default function ArenaCanvas() {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) {
      return;
    }
    const game = createArenaGame(parent);
    return () => {
      game.destroy(true);
    };
  }, []);

  return (
    <div
      ref={parentRef}
      className="arena-canvas"
      role="img"
      aria-label="Arène Tokyo Underground, précédée d'une cinématique d'entrée : cour de temple sous la pluie, lune rouge, cerisier en fleurs et ville au néon. Moussa s'y tient en garde face à Shigaraki ; il peut marcher, dasher, s'accroupir, parer, sauter et enchaîner coups de poing et coup de pied, qui font vaciller Shigaraki quand ils le touchent."
    />
  );
}
