import { describe, expect, it } from 'vitest';
import { CINEMATIC_FIGHT_AT, CINEMATIC_SHOTS, Cinematic } from './cinematic';
import type { CinematicTexts } from './cinematic';

const TEXTS: CinematicTexts = {
  hero: { title: 'A', subtitle: 'B' },
  rival: { title: 'C', subtitle: 'D' },
  destiny: 'E',
  round: (round) => `R${round}`,
  fight: 'F',
};
const IMAGE = { width: 10, height: 10 } as unknown as HTMLImageElement;

/** Fait avancer la cinématique de `seconds` secondes, par images de 1/60 s. */
function run(cinematic: Cinematic, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) {
    cinematic.update(1 / 60);
  }
}

describe('Cinematic', () => {
  it('ne démarre pas tant qu’un plan manque', () => {
    const cinematic = new Cinematic(TEXTS);
    cinematic.setImages(CINEMATIC_SHOTS.map((_, index) => (index === 0 ? null : IMAGE)));
    cinematic.start();
    expect(cinematic.playing).toBe(false);
    expect(cinematic.locked).toBe(false);
  });

  it('recouvre le stage pendant les plans, bloque le personnage jusqu’au « Fight » puis s’arrête', () => {
    const cinematic = new Cinematic(TEXTS);
    cinematic.setImages(CINEMATIC_SHOTS.map(() => IMAGE));
    cinematic.start();
    expect(cinematic.covering).toBe(true);
    expect(cinematic.locked).toBe(true);
    run(cinematic, CINEMATIC_FIGHT_AT - 0.5);
    expect(cinematic.covering).toBe(false);
    expect(cinematic.locked).toBe(true);
    run(cinematic, 0.6);
    expect(cinematic.locked).toBe(false);
    run(cinematic, 2);
    expect(cinematic.playing).toBe(false);
  });

  it('passe les plans d’un coup, mais garde les annonces', () => {
    const cinematic = new Cinematic(TEXTS);
    cinematic.setImages(CINEMATIC_SHOTS.map(() => IMAGE));
    cinematic.start();
    run(cinematic, 1);
    cinematic.skip();
    expect(cinematic.covering).toBe(false);
    expect(cinematic.locked).toBe(true);
  });
});
