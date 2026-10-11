import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createArenaGame } from '../game/config';
import { CONTROLS } from '../game/controls';

/** Commandes des boutons de la page, transmises à la scène. Le clavier est lu par la scène elle-même. */
export interface ArenaCommands {
  /** Déplacement demandé : 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt. */
  walk: number;
  /** Vrai tant que le personnage doit rester accroupi. */
  crouch: boolean;
  /** Vrai tant que le personnage doit parer. */
  block: boolean;
  /** Compteur : l'augmenter lance un saut. */
  jump: number;
  /** Compteur : l'augmenter est un appui sur la touche d'attaque. */
  attack: number;
}

/**
 * Pont entre React et Phaser : monte l'arène dans un conteneur dédié.
 * Le moteur n'est créé qu'au montage et détruit au démontage ; les commandes lui sont transmises par son
 * registre, sans le recréer.
 */
export default function ArenaCanvas({ walk, crouch, block, jump, attack }: ArenaCommands) {
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
    gameRef.current?.registry.set(CONTROLS.walk, walk);
  }, [walk]);
  useEffect(() => {
    gameRef.current?.registry.set(CONTROLS.crouch, crouch);
  }, [crouch]);
  useEffect(() => {
    gameRef.current?.registry.set(CONTROLS.block, block);
  }, [block]);
  useEffect(() => {
    gameRef.current?.registry.set(CONTROLS.jump, jump);
  }, [jump]);
  useEffect(() => {
    gameRef.current?.registry.set(CONTROLS.attack, attack);
  }, [attack]);

  return (
    <div
      ref={parentRef}
      className="arena-canvas"
      role="img"
      aria-label="Arène Tokyo Underground : cour de temple sous la pluie, lune rouge, cerisier en fleurs et ville au néon. Moussa s'y tient en garde ; il peut marcher, dasher, s'accroupir, parer, sauter et donner des coups de poing."
    />
  );
}
