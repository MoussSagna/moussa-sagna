import { describe, expect, it } from 'vitest';
import {
  BLOCK_STEP_SECONDS,
  CHAIN_GRACE,
  CROUCH_STEP_SECONDS,
  DASH,
  DOUBLE_TAP_MS,
  DoubleTap,
  HeroState,
  JUMP,
  PLACEMENT,
  PUNCHES,
  STEP_SECONDS,
} from './heroState';

const ASPECT = 720 / 1280;
const FRAME = 1 / 60;

/** Fait avancer l'état pendant `seconds`, image par image. */
function run(hero: HeroState, seconds: number, direction: number, crouch = false, block = false): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) {
    hero.update(FRAME, direction, ASPECT, crouch, block);
  }
}

describe('HeroState', () => {
  it('reste en garde et sur place sans commande', () => {
    const hero = new HeroState();
    run(hero, 1, 0);
    expect(hero.pose).toBe('guard');
    expect(hero.x).toBe(PLACEMENT.x);
  });

  it('passe par la pose intermédiaire avant de marcher, puis avant de revenir en garde', () => {
    const hero = new HeroState();
    hero.update(FRAME, 1, ASPECT);
    expect(hero.pose).toBe('step');
    run(hero, STEP_SECONDS + FRAME, 1);
    expect(hero.pose).toBe('walk');
    hero.update(FRAME, 0, ASPECT);
    expect(hero.pose).toBe('step');
    run(hero, STEP_SECONDS + FRAME, 0);
    expect(hero.pose).toBe('guard');
  });

  it('avance vers la droite, recule vers la gauche', () => {
    const hero = new HeroState();
    run(hero, 1, 1);
    const forward = hero.x;
    expect(forward).toBeGreaterThan(PLACEMENT.x);
    run(hero, 0.5, -1);
    expect(hero.x).toBeLessThan(forward);
  });

  it('s’arrête aux bords de l’arène et repasse en garde', () => {
    const hero = new HeroState();
    run(hero, 30, 1);
    expect(hero.x).toBe(PLACEMENT.maxX);
    expect(hero.pose).toBe('guard');
    run(hero, 30, -1);
    expect(hero.x).toBe(PLACEMENT.minX);
  });

  it('dashe sur une distance fixe puis revient en garde', () => {
    const hero = new HeroState();
    hero.dash(1);
    expect(hero.illustration).toBe('dashForward');
    run(hero, DASH.forward.seconds / 2, 0);
    expect(hero.pose).toBe('dash');
    // le déplacement part vite : plus de la moitié du chemin est faite à mi-durée
    expect(hero.x - PLACEMENT.x).toBeGreaterThan(DASH.forward.distance / 2);
    run(hero, DASH.forward.seconds, 0);
    expect(hero.pose).toBe('guard');
    expect(hero.x).toBeCloseTo(PLACEMENT.x + DASH.forward.distance, 5);

    hero.dash(-1);
    expect(hero.illustration).toBe('dashBack');
    run(hero, DASH.back.seconds + FRAME, 0);
    expect(hero.x).toBeCloseTo(PLACEMENT.x + DASH.forward.distance - DASH.back.distance, 5);
  });

  it('ignore une demande de dash pendant un dash, et ne sort pas de l’arène', () => {
    const hero = new HeroState();
    hero.dash(-1);
    hero.dash(1);
    expect(hero.illustration).toBe('dashBack');
    for (let n = 0; n < 6; n++) {
      run(hero, DASH.back.seconds + FRAME, 0);
      hero.dash(-1);
    }
    expect(hero.x).toBeGreaterThanOrEqual(PLACEMENT.minX);
  });
});

describe('accroupi et parade', () => {
  it('s’accroupit et se relève en passant par la pose à mi-descente', () => {
    const hero = new HeroState();
    hero.update(FRAME, 0, ASPECT, true);
    expect(hero.pose).toBe('crouchStep');
    run(hero, CROUCH_STEP_SECONDS + FRAME, 0, true);
    expect(hero.pose).toBe('crouch');
    hero.update(FRAME, 0, ASPECT, false);
    expect(hero.pose).toBe('crouchStep');
    run(hero, CROUCH_STEP_SECONDS + FRAME, 0);
    expect(hero.pose).toBe('guard');
  });

  it('pare debout avec une pose de passage, et accroupi sans', () => {
    const hero = new HeroState();
    hero.update(FRAME, 0, ASPECT, false, true);
    expect(hero.pose).toBe('blockStep');
    run(hero, BLOCK_STEP_SECONDS + FRAME, 0, false, true);
    expect(hero.pose).toBe('block');
    run(hero, 0.5, 0);
    expect(hero.pose).toBe('guard');

    run(hero, 0.5, 0, true);
    expect(hero.pose).toBe('crouch');
    hero.update(FRAME, 0, ASPECT, true, true);
    expect(hero.pose).toBe('crouchBlock');
    hero.update(FRAME, 0, ASPECT, true, false);
    expect(hero.pose).toBe('crouch');
  });

  it('ne se déplace ni accroupi ni en parade, et ne dashe pas', () => {
    const hero = new HeroState();
    run(hero, 1, 1, true);
    expect(hero.x).toBe(PLACEMENT.x);
    hero.dash(1);
    expect(hero.pose).toBe('crouch');
    run(hero, 0.5, 0);
    run(hero, 1, 1, false, true);
    expect(hero.x).toBe(PLACEMENT.x);
  });

  it('arrête d’abord la marche quand on s’accroupit en marchant', () => {
    const hero = new HeroState();
    run(hero, 0.5, 1);
    expect(hero.pose).toBe('walk');
    const seen = new Set<string>();
    for (let n = 0; n < 30; n++) {
      hero.update(FRAME, 1, ASPECT, true);
      seen.add(hero.pose);
    }
    expect(hero.pose).toBe('crouch');
    expect(seen.has('guard') || seen.has('step')).toBe(true);
  });
});

describe('saut', () => {
  it('enchaîne impulsion, montée, corps regroupé et réception, puis revient en garde', () => {
    const hero = new HeroState();
    hero.jump();
    const order: string[] = [];
    let highest = 0;
    for (let n = 0; n < 120 && hero.pose === 'jump'; n++) {
      const frame = hero.jumpFrame();
      if (order[order.length - 1] !== frame.name) {
        order.push(frame.name);
      }
      highest = Math.max(highest, frame.lift);
      hero.update(FRAME, 0, ASPECT);
    }
    expect(order).toEqual(['jumpStart', 'jumpRise', 'jumpPeak', 'jumpLand']);
    expect(highest).toBeGreaterThan(JUMP.height * 0.98);
    expect(highest).toBeLessThanOrEqual(JUMP.height);
    expect(hero.pose).toBe('guard');
    expect(hero.x).toBe(PLACEMENT.x);
  });

  it('avance pendant un saut avant, recule moins loin pendant un saut arrière', () => {
    const forward = new HeroState();
    forward.jump(1);
    run(forward, JUMP.start + JUMP.rise / 2, 0);
    const midway = forward.x;
    expect(midway).toBeGreaterThan(PLACEMENT.x);
    expect(midway).toBeLessThan(PLACEMENT.x + JUMP.forward);
    run(forward, JUMP.rise + JUMP.fall + JUMP.land, 0);
    expect(forward.pose).toBe('guard');
    expect(forward.x).toBeCloseTo(PLACEMENT.x + JUMP.forward, 6);

    const back = new HeroState();
    back.jump(-1);
    run(back, JUMP.start + JUMP.rise + JUMP.fall + JUMP.land + FRAME, 0);
    expect(back.x).toBeCloseTo(PLACEMENT.x - JUMP.back, 6);
  });

  it('ne sort pas du stage en sautant', () => {
    const hero = new HeroState();
    hero.x = PLACEMENT.maxX - 0.02;
    hero.jump(1);
    run(hero, JUMP.start + JUMP.rise + JUMP.fall + JUMP.land + FRAME, 0);
    expect(hero.x).toBe(PLACEMENT.maxX);
  });

  it('reste au sol pendant l’impulsion et la réception', () => {
    const hero = new HeroState();
    hero.jump();
    expect(hero.jumpFrame().lift).toBe(0);
    run(hero, JUMP.start + JUMP.rise + JUMP.fall + FRAME, 0);
    expect(hero.jumpFrame().name).toBe('jumpLand');
    expect(hero.jumpFrame().lift).toBe(0);
  });

  it('ne part ni accroupi, ni pendant un dash ou un autre saut', () => {
    const hero = new HeroState();
    run(hero, 0.5, 0, true);
    hero.jump();
    expect(hero.pose).toBe('crouch');
    run(hero, 0.5, 0);
    hero.dash(1);
    hero.jump();
    expect(hero.pose).toBe('dash');
  });
});

describe('coups de poing', () => {
  const light = PUNCHES.light;
  const medium = PUNCHES.medium;
  const heavy = PUNCHES.heavy;
  const kick = PUNCHES.kick;

  it('joue le coup léger seul : démarrage, bras tendu, retour, puis garde', () => {
    const hero = new HeroState();
    hero.attack();
    expect(hero.illustration).toBe('jab1');
    run(hero, light.startup + FRAME / 2, 0);
    expect(hero.illustration).toBe('jab5');
    run(hero, light.active, 0);
    expect(hero.illustration).toBe('jab6');
    run(hero, light.recovery + FRAME, 0);
    expect(hero.pose).toBe('guard');
  });

  it('enchaîne le coup moyen sur un second appui, à la place de la récupération', () => {
    const hero = new HeroState();
    hero.attack();
    hero.update(FRAME, 0, ASPECT);
    hero.attack();
    const order: string[] = [];
    for (let n = 0; n < 120 && hero.pose === 'punch'; n++) {
      if (order[order.length - 1] !== hero.illustration) {
        order.push(hero.illustration);
      }
      hero.update(FRAME, 0, ASPECT);
    }
    // le jab (démarrage en quatre dessins, un par image : le premier est passé avant le second appui), puis le coup
    // moyen à la place de sa récupération
    expect(order[0]).toBe('jab2');
    expect(order).toContain('jab5');
    expect(order).not.toContain('jab6');
    expect(order.slice(order.indexOf('punchChain1'))).toEqual(['punchChain1', 'punchChain2', 'punchMidHit', 'punchMidRecover']);
    expect(hero.punchStrength).toBe('medium');
    expect(hero.pose).toBe('guard');
  });

  it('enchaîne le coup fort sur un troisième appui, puis le coup de pied sur un quatrième, et s’arrête', () => {
    const hero = new HeroState();
    hero.attack();
    hero.update(FRAME, 0, ASPECT);
    hero.attack();
    run(hero, light.startup + light.active + FRAME, 0);
    expect(hero.punchStrength).toBe('medium');
    hero.attack();
    run(hero, medium.startup + medium.active + FRAME, 0);
    expect(hero.punchStrength).toBe('heavy');
    expect(hero.illustration).toBe('punchHeavyStart');
    hero.attack();
    run(hero, heavy.startup + heavy.active + FRAME, 0);
    expect(hero.punchStrength).toBe('kick');
    expect(hero.illustration).toBe('kickStart');
    run(hero, kick.startup, 0);
    expect(hero.illustration).toBe('kickHit');
    // rien ne suit le coup de pied : un nouvel appui ne relance rien
    hero.attack();
    run(hero, kick.active + kick.recovery + FRAME, 0);
    expect(hero.pose).toBe('guard');
  });

  it('poursuit l’enchaînement sur un appui juste après le retour en garde, pas plus tard', () => {
    const hero = new HeroState();
    hero.attack();
    run(hero, light.startup + light.active + light.recovery + FRAME, 0);
    expect(hero.pose).toBe('guard');
    hero.attack();
    expect(hero.punchStrength).toBe('medium');
    run(hero, medium.startup + medium.active + medium.recovery + FRAME, 0);
    run(hero, CHAIN_GRACE + 0.1, 0);
    hero.attack();
    expect(hero.punchStrength).toBe('light');
  });

  it('ne part pas accroupi', () => {
    const hero = new HeroState();
    run(hero, 0.5, 0, true);
    hero.attack();
    expect(hero.pose).toBe('crouch');
  });
});

describe('DoubleTap', () => {
  it('ne se déclenche qu’au second appui rapproché dans le même sens', () => {
    const taps = new DoubleTap();
    expect(taps.tap(1, 1000)).toBe(false);
    expect(taps.tap(1, 1000 + DOUBLE_TAP_MS - 1)).toBe(true);
    // le compteur repart de zéro : un troisième appui ne redéclenche pas
    expect(taps.tap(1, 1000 + DOUBLE_TAP_MS)).toBe(false);
  });

  it('ignore deux appuis trop espacés ou dans des sens opposés', () => {
    const taps = new DoubleTap();
    expect(taps.tap(1, 0)).toBe(false);
    expect(taps.tap(1, DOUBLE_TAP_MS + 1)).toBe(false);
    expect(taps.tap(-1, DOUBLE_TAP_MS + 50)).toBe(false);
  });
});
