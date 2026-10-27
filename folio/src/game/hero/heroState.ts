import { CANVAS } from './poseData';
import type { POSES } from './poseData';
import { GAIT, WALK_SPEED } from './poseRig';

/** Une illustration du personnage. */
export type PoseName = keyof typeof POSES;

/** Ce que fait le personnage. Le dash, le saut et le coup de poing affichent plusieurs illustrations. */
export type HeroAction =
  | 'guard'
  | 'step'
  | 'walk'
  | 'dash'
  | 'crouchStep'
  | 'crouch'
  | 'blockStep'
  | 'block'
  | 'crouchBlock'
  | 'jump'
  | 'punch';

/** Position sur le stage, en fraction de l'écran ; `scale` = hauteur de la toile en hauteurs d'écran. */
export const PLACEMENT = { x: 0.33, y: 0.905, scale: 0.546, depth: 0.42, minX: 0.14, maxX: 0.8 };

/** Durée de la pose intermédiaire entre la garde et la marche, en secondes. */
export const STEP_SECONDS = 0.09;
/** Durée de la pose à mi-descente entre la garde et l'accroupi, en secondes. */
export const CROUCH_STEP_SECONDS = 0.07;
/** Durée de la pose de passage entre la garde et la parade debout, en secondes. */
export const BLOCK_STEP_SECONDS = 0.05;

/** Dash : distance en fraction de la largeur de l'écran, durée en secondes. Le déplacement part vite et freine. */
export const DASH = {
  forward: { distance: 0.17, seconds: 0.3 },
  back: { distance: 0.13, seconds: 0.26 },
};

/**
 * Saut vertical. Durées en secondes, hauteur en pixels de la toile (du sol au point le plus haut des pieds).
 * `tuck` : part de la montée après laquelle le corps se regroupe ; avant, il est encore en extension.
 * Un seul dessin couvre presque tout le vol : c'est sa déformation continue qui donne le mouvement.
 */
export const JUMP = {
  start: 0.07,
  /** Montée puis retombée : la retombée est plus courte, le personnage tombe plus vite qu'il ne monte. */
  rise: 0.3,
  fall: 0.22,
  land: 0.1,
  height: 600,
  tuck: 0.26,
  /** Déformation du dessin : tassement à l'impulsion et à la réception, étirement à pleine vitesse. */
  squash: 0.09,
  stretch: 0.07,
  /**
   * Sauts avant et arrière : distance parcourue en vol, en fraction de la largeur de l'écran. Le saut
   * arrière va moins loin. (Le lab incline aussi le corps dans le sens du saut ; `HeroRig.show` ne gère
   * pas encore le cisaillement, donc le folio ne reprend pas cette inclinaison.)
   */
  forward: 0.17,
  back: 0.13,
};

interface Punch {
  startup: number;
  active: number;
  recovery: number;
  /** Distance entre l'aplomb des hanches et le bout du poing tendu, en pixels de la toile : là où le coup touche. */
  reach: number;
  /** Hauteur du coup au-dessus du sol, en pixels de la toile (où jaillit l'étincelle). */
  height: number;
  /** Puissance : 1 pour un coup fort. Elle règle l'inclinaison de l'adversaire et la secousse. */
  power: number;
  /** Arrêt sur image quand le coup touche, en secondes. */
  stop: number;
  /** Dessins du démarrage, qui se partagent sa durée. */
  start: PoseName[];
  hit: PoseName;
  /** Dessins de la récupération, qui se partagent sa durée. */
  recover: PoseName[];
}

/**
 * Coups de poing debout. Durées en secondes, calquées sur des coups de jeu de combat à 60 images par
 * seconde (démarrage, actif, récupération). Le léger est un jab de boxeur en six dessins : quatre au
 * démarrage, le bras tendu, puis le retour en garde en repassant par les dessins du démarrage. Le moyen
 * ne s'obtient qu'en enchaînant après le léger : son démarrage est fait des deux dessins de transition
 * entre le jab et le direct. Le fort, un uppercut du bras avant, ne s'obtient qu'en
 * enchaînant après le moyen, et le coup de pied haut, quatrième et dernier coup, après le fort. Portée, hauteur,
 * puissance et arrêt sur image sont ceux du lab.
 */
export const PUNCHES = {
  light: {
    startup: 4 / 60,
    active: 3 / 60,
    recovery: 7 / 60,
    reach: 580,
    height: 1010,
    power: 0.35,
    stop: 0.06,
    start: ['jab1', 'jab2', 'jab3', 'jab4'],
    hit: 'jab5',
    recover: ['jab6', 'jab4', 'jab2', 'jab1'],
  },
  medium: {
    startup: 6 / 60,
    active: 4 / 60,
    recovery: 11 / 60,
    reach: 560,
    height: 960,
    power: 0.6,
    stop: 0.09,
    start: ['punchChain1', 'punchChain2'],
    hit: 'punchMidHit',
    recover: ['punchMidRecover'],
  },
  heavy: {
    startup: 11 / 60,
    active: 6 / 60,
    recovery: 20 / 60,
    reach: 480,
    height: 1150,
    power: 1,
    stop: 0.15,
    start: ['punchHeavyStart'],
    hit: 'punchHeavyHit',
    recover: ['punchHeavyRecover'],
  },
  kick: {
    startup: 6 / 60,
    active: 4 / 60,
    recovery: 11 / 60,
    reach: 700,
    height: 1220,
    power: 1,
    stop: 0.17,
    start: ['kickStart'],
    hit: 'kickHit',
    recover: ['kickStart'],
  },
} satisfies Record<string, Punch>;
export type PunchStrength = keyof typeof PUNCHES;

/**
 * Enchaînement : une seule touche d'attaque. Un nouvel appui pendant un coup met le suivant en attente ;
 * il part dès la fin des images actives, sans attendre la récupération.
 */
const CHAIN: Partial<Record<PunchStrength, PunchStrength>> = { light: 'medium', medium: 'heavy', heavy: 'kick' };
/**
 * Délai de grâce, en secondes : après la fin d'un coup, un appui pendant ce délai lance encore le coup
 * suivant au lieu de recommencer au premier. Sans lui, il faudrait appuyer pendant le quart de seconde du coup.
 */
export const CHAIN_GRACE = 0.35;

/** Deux appuis sur la même direction en moins de ce délai (millisecondes) déclenchent un dash. */
export const DOUBLE_TAP_MS = 260;

/** Repère le double appui : `tap` renvoie `true` au second appui rapproché dans le même sens. */
export class DoubleTap {
  private last = { direction: 0, at: 0 };

  tap(direction: number, now: number): boolean {
    if (this.last.direction === direction && now - this.last.at < DOUBLE_TAP_MS) {
      this.last = { direction: 0, at: 0 };
      return true;
    }
    this.last = { direction, at: now };
    return false;
  }
}

/** Un coup qui peut toucher à cet instant : son bout (fraction de la largeur du stage), sa hauteur, sa puissance. */
export interface Strike {
  x: number;
  height: number;
  power: number;
  stop: number;
}

/** Dessin, hauteur des pieds (pixels de la toile) et déformation (largeur, hauteur) à un instant du saut. */
export interface JumpFrame {
  name: PoseName;
  lift: number;
  sx: number;
  sy: number;
}

/**
 * État du personnage, repris de `HeroLayer` de `lab/` : garde, marche, dash, accroupi, parade, saut et
 * coups de poing. On ne saute jamais directement de la garde à la marche, à l'accroupi ou à la parade
 * debout : une pose de passage s'affiche un instant.
 */
export class HeroState {
  /** Position horizontale, en fraction de la largeur de l'écran. */
  x = PLACEMENT.x;
  pose: HeroAction = 'guard';
  /** Phase du cycle de marche, de 0 à 1. */
  phase = 0;
  /** Dash en cours : sens, position de départ et temps écoulé. */
  dashing = { direction: 1, from: PLACEMENT.x, time: 0 };
  /** Coup de poing en cours. */
  punchStrength: PunchStrength = 'light';
  /** Temps écoulé depuis le début du coup de poing en cours. */
  private punchTime = 0;
  /** Vrai si la touche d'attaque a été pressée à nouveau pendant le coup en cours. */
  private punchQueued = false;
  /** Temps écoulé depuis la fin du dernier coup, tant qu'aucune autre action n'a eu lieu. */
  private sincePunch = Number.POSITIVE_INFINITY;
  /** Temps écoulé depuis le début du saut en cours. */
  private jumpTime = 0;
  /** Saut en cours : sens (1 avant, -1 arrière, 0 vertical) et position au décollage. */
  jumping = { direction: 0, from: PLACEMENT.x };
  /** Temps restant dans la pose de passage. */
  private stepLeft = 0;
  /** Vrai une fois que le coup de poing en cours a touché : il ne touche qu'une fois. */
  private punchLanded = false;
  /**
   * Limite avant imposée par l'adversaire (fraction de la largeur du stage) : le personnage ne le traverse pas.
   * Le bord du stage reste la limite tant qu'il est plus près.
   */
  wall: number = PLACEMENT.maxX;

  /** Limite avant : le bord du stage, ou l'adversaire s'il est plus près. */
  private get limit(): number {
    return Math.min(PLACEMENT.maxX, this.wall);
  }

  /** Vrai en garde ou en marche : les seuls états d'où partent un dash, un saut ou un coup. */
  private get free(): boolean {
    return this.pose === 'guard' || this.pose === 'step' || this.pose === 'walk';
  }

  /** L'illustration à afficher pour l'état courant. */
  get illustration(): PoseName {
    switch (this.pose) {
      case 'dash':
        return this.dashing.direction > 0 ? 'dashForward' : 'dashBack';
      case 'jump':
        return this.jumpFrame().name;
      case 'punch':
        return this.punchPose();
      default:
        return this.pose;
    }
  }

  /** Lance un dash : 1 vers l'avant, -1 vers l'arrière. Possible seulement depuis la garde ou la marche. */
  dash(direction: number): void {
    if (!this.free || direction === 0) {
      return;
    }
    this.pose = 'dash';
    this.dashing = { direction: Math.sign(direction), from: this.x, time: 0 };
  }

  /** Position du personnage `time` secondes après le début du dash en cours. */
  dashX(time: number): number {
    const move = this.dashing.direction > 0 ? DASH.forward : DASH.back;
    const k = Math.max(0, Math.min(1, time / move.seconds));
    const eased = 1 - (1 - k) ** 3;
    const x = this.dashing.from + this.dashing.direction * move.distance * eased;
    return Math.max(PLACEMENT.minX, Math.min(this.limit, x));
  }

  /**
   * Lance un saut : vertical, ou vers l'avant (1) ou l'arrière (-1) si une direction est tenue.
   * Possible seulement depuis la garde ou la marche.
   */
  jump(direction = 0): void {
    if (!this.free) {
      return;
    }
    this.pose = 'jump';
    this.jumpTime = 0;
    this.jumping = { direction: Math.sign(direction), from: this.x };
  }

  /** Avancée du vol, de 0 au décollage à 1 à l'atterrissage : le corps garde une vitesse horizontale constante. */
  private jumpFlight(): number {
    return Math.max(0, Math.min(1, (this.jumpTime - JUMP.start) / (JUMP.rise + JUMP.fall)));
  }

  /**
   * Le saut à l'instant courant. Le dessin se tasse pendant l'impulsion, s'étire quand il va vite,
   * reprend sa forme au sommet, puis s'écrase à la réception avant de se redresser.
   */
  jumpFrame(): JumpFrame {
    const t = this.jumpTime - JUMP.start;
    if (t < 0) {
      const p = 1 + t / JUMP.start;
      const squash = JUMP.squash * p * p;
      return { name: 'jumpStart', lift: 0, sx: 1 + squash * 0.5, sy: 1 - squash };
    }
    if (t >= JUMP.rise + JUMP.fall) {
      const q = Math.min(1, (t - JUMP.rise - JUMP.fall) / JUMP.land);
      const squash = JUMP.squash * (1 - q) ** 2;
      return { name: 'jumpLand', lift: 0, sx: 1 + squash * 0.5, sy: 1 - squash };
    }
    // deux demi-paraboles qui se rejoignent au sommet ; vitesse verticale : 1 au décollage, 0 au sommet, 1 à la retombée
    const rising = t < JUMP.rise;
    const speed = rising ? 1 - t / JUMP.rise : (t - JUMP.rise) / JUMP.fall;
    const stretch = JUMP.stretch * speed * speed;
    return {
      name: rising && t / JUMP.rise < JUMP.tuck ? 'jumpRise' : 'jumpPeak',
      lift: JUMP.height * (1 - speed * speed),
      sx: 1 - stretch * 0.6,
      sy: 1 + stretch,
    };
  }

  /**
   * Touche d'attaque. Depuis la garde ou la marche, lance le coup léger ; pendant un coup, met en attente
   * le coup suivant de l'enchaînement.
   */
  attack(): void {
    if (this.pose === 'punch') {
      if (CHAIN[this.punchStrength]) {
        this.punchQueued = true;
      }
      return;
    }
    if (!this.free) {
      return;
    }
    // juste après un coup, l'appui poursuit l'enchaînement ; sinon il repart du coup léger
    const next = this.sincePunch < CHAIN_GRACE ? CHAIN[this.punchStrength] : undefined;
    this.pose = 'punch';
    this.punchStrength = next ?? 'light';
    this.punchTime = 0;
    this.punchQueued = false;
    this.punchLanded = false;
  }

  /**
   * Le coup qui peut toucher à cet instant : pendant ses images actives, tant qu'il n'a pas déjà touché.
   * `pixel` : largeur d'un pixel de la toile, en fraction de la largeur du stage.
   */
  strike(pixel: number): Strike | null {
    if (this.pose !== 'punch' || this.punchLanded) {
      return null;
    }
    const move: Punch = PUNCHES[this.punchStrength];
    if (this.punchTime < move.startup || this.punchTime >= move.startup + move.active) {
      return null;
    }
    return { x: this.x + move.reach * pixel, height: move.height, power: move.power, stop: move.stop };
  }

  /** Le coup en cours a touché : il ne touchera plus. */
  land(): void {
    this.punchLanded = true;
  }

  /** Dessin du coup de poing en cours : démarrage, bras tendu pendant les images actives, puis récupération. */
  private punchPose(): PoseName {
    const move: Punch = PUNCHES[this.punchStrength];
    if (this.punchTime < move.startup) {
      const index = Math.floor((this.punchTime / move.startup) * move.start.length);
      return move.start[Math.min(move.start.length - 1, index)] ?? move.hit;
    }
    if (this.punchTime < move.startup + move.active) {
      return move.hit;
    }
    const k = (this.punchTime - move.startup - move.active) / move.recovery;
    const index = Math.floor(k * move.recover.length);
    return move.recover[Math.max(0, Math.min(move.recover.length - 1, index))] ?? move.hit;
  }

  /**
   * Fait avancer l'état du personnage. Accroupi ou en parade, il ne se déplace pas.
   *
   * @param delta durée de l'image, en secondes
   * @param direction 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt
   * @param aspect hauteur de la scène divisée par sa largeur
   * @param crouch s'accroupir tant que c'est vrai
   * @param block parer tant que c'est vrai
   */
  update(delta: number, direction: number, aspect: number, crouch = false, block = false): void {
    if (this.pose === 'dash') {
      this.dashing.time += delta;
      this.x = this.dashX(this.dashing.time);
      const move = this.dashing.direction > 0 ? DASH.forward : DASH.back;
      if (this.dashing.time < move.seconds) {
        return;
      }
      this.pose = 'guard';
    }
    // le délai de grâce ne court qu'en garde : toute autre action l'annule
    if (this.pose === 'guard') {
      this.sincePunch += delta;
    } else if (this.pose !== 'punch') {
      this.sincePunch = Number.POSITIVE_INFINITY;
    }
    if (this.pose === 'punch') {
      this.punchTime += delta;
      const move: Punch = PUNCHES[this.punchStrength];
      const next = CHAIN[this.punchStrength];
      if (next && this.punchQueued && this.punchTime >= move.startup + move.active) {
        // le coup suivant remplace la récupération de celui-ci
        this.punchStrength = next;
        this.punchTime = 0;
        this.punchQueued = false;
        this.punchLanded = false;
        return;
      }
      if (this.punchTime < move.startup + move.active + move.recovery) {
        return;
      }
      this.pose = 'guard';
      this.sincePunch = 0;
    }
    if (this.pose === 'jump') {
      this.jumpTime += delta;
      // saut avant ou arrière : le corps avance pendant tout le vol, sans sortir du stage
      const { direction: jumpDirection, from } = this.jumping;
      if (jumpDirection !== 0) {
        const distance = jumpDirection > 0 ? JUMP.forward : JUMP.back;
        this.x = Math.max(PLACEMENT.minX, Math.min(this.limit, from + jumpDirection * distance * this.jumpFlight()));
      }
      if (this.jumpTime < JUMP.start + JUMP.rise + JUMP.fall + JUMP.land) {
        return;
      }
      this.pose = 'guard';
    }
    // poses de passage : elles durent un instant, puis on arrive selon ce qui est encore demandé
    if (this.pose === 'crouchStep' || this.pose === 'blockStep') {
      this.stepLeft -= delta;
      if (this.stepLeft > 0) {
        return;
      }
      if (this.pose === 'crouchStep') {
        this.pose = crouch ? 'crouch' : 'guard';
      } else {
        this.pose = block && !crouch ? 'block' : 'guard';
      }
      return;
    }
    // accroupi : la parade basse se prend et se quitte sans pose de passage
    if (this.pose === 'crouch' || this.pose === 'crouchBlock') {
      if (!crouch) {
        this.pass('crouchStep');
      } else {
        this.pose = block ? 'crouchBlock' : 'crouch';
      }
      return;
    }
    if (this.pose === 'block') {
      if (!block || crouch) {
        this.pass('blockStep');
      }
      return;
    }
    if (this.pose === 'guard' && (crouch || block)) {
      this.pass(crouch ? 'crouchStep' : 'blockStep');
      return;
    }
    const blocked = (direction > 0 && this.x >= this.limit) || (direction < 0 && this.x <= PLACEMENT.minX);
    // demander l'accroupi ou la parade en marchant arrête d'abord la marche : le personnage repasse par la garde
    const moving = direction !== 0 && !blocked && !crouch && !block;
    // garde <-> pose intermédiaire <-> marche : on ne saute jamais directement d'un bout à l'autre
    if (this.pose === 'step') {
      this.stepLeft -= delta;
      if (this.stepLeft <= 0) {
        this.pose = moving ? 'walk' : 'guard';
        this.phase = 0;
      }
    } else if ((this.pose === 'guard') === moving) {
      this.pose = 'step';
      this.stepLeft = STEP_SECONDS;
    }
    if (this.pose !== 'walk' || !moving) {
      return;
    }
    this.phase = (((this.phase + (direction * delta) / GAIT.period) % 1) + 1) % 1;
    // le corps avance à la vitesse du pied posé ; jouer le cycle à l'envers donne la marche arrière
    const pixel = (PLACEMENT.scale / CANVAS[1]) * aspect;
    this.x = Math.max(PLACEMENT.minX, Math.min(this.limit, this.x + direction * WALK_SPEED * pixel * delta));
  }

  private pass(pose: 'crouchStep' | 'blockStep'): void {
    this.pose = pose;
    this.stepLeft = pose === 'crouchStep' ? CROUCH_STEP_SECONDS : BLOCK_STEP_SECONDS;
  }
}
