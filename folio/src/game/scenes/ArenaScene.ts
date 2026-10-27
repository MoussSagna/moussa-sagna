import Phaser from 'phaser';
import { STAGE_BACKGROUND_URL, STAGE_DEPTH_URL, cinematicShotUrl, rivalPoseUrl } from '../../assets';
import { CINEMATIC_TEXTS } from '../../data/cinematic';
import { CINEMATIC_SHOTS, Cinematic } from '../cinematic/cinematic';
import { HeroAtlases } from '../hero/HeroAtlases';
import { GROUND, HeroRig, feetOf, singleLayerPlacement } from '../hero/HeroRig';
import { DoubleTap, HeroState, JUMP, PLACEMENT } from '../hero/heroState';
import type { PoseName } from '../hero/heroState';
import { CANVAS, POSES } from '../hero/poseData';
import { guardMatrices, heldMatrix, scaleAbout, walkMatrices } from '../hero/poseRig';
import type { Affine } from '../hero/poseRig';
import { ArenaKeyboard } from '../input';
import { RIVAL_BODY, RIVAL_POSES, RivalState } from '../rival/rivalState';
import type { RivalPoseName } from '../rival/rivalState';
import { computeCamera } from '../stage/camera';
import type { StageCamera } from '../stage/camera';
import { STAGE_FRAGMENT, STAGE_TEXTURE_DATA, STAGE_UNIFORMS } from '../stage/shaders';
import { Weather } from '../stage/Weather';

const BACKGROUND_KEY = 'arena-background';
const DEPTH_KEY = 'arena-depth';
const SHADER_KEY = 'arena-stage';

/** Hauteur du sol de l'arène dans l'espace logique, alignée sur le dallage du décor. */
const GROUND_Y = 610;

const COLOR_NIGHT = 0x070b12;
const COLOR_NIGHT_BLUE = 0x101d2d;
const COLOR_RED = 0xf51f3b;

/** Le métro traverse le viaduc en `TRAIN_RUN` secondes, toutes les `TRAIN_EVERY` secondes. */
const TRAIN_EVERY = 17;
const TRAIN_RUN = 7;

/** Ordre des plans : décor, reflet, ombre, images fantômes du dash, personnage, puis la météo devant tout. */
const REFLECTION_DEPTH = 1;
const SHADOW_DEPTH = 2;
const GHOST_DEPTH = 3;
/** Shigaraki, derrière Moussa, et les étincelles des coups, devant les deux. */
const RIVAL_DEPTH = 3.5;
const HERO_DEPTH = 4;
const SPARK_DEPTH = 5;
const WEATHER_DEPTH = 100;
/** La cinématique d'entrée recouvre tout, météo comprise. */
const CINEMATIC_DEPTH = 200;
const CINEMATIC_KEY = 'arena-cinematic';
const cinematicShotKey = (shot: string): string => `cinematic-${shot}`;

const SHADOW_KEY = 'hero-shadow';
const SPARK_KEY = 'hit-spark';
const rivalPoseKey = (pose: RivalPoseName): string => `rival-${pose}`;
const RIVAL_POSE_NAMES = Object.keys(RIVAL_POSES) as RivalPoseName[];
/** Taille des images de Shigaraki : la toile de 1024 × 1536, comme celle de Moussa. */
const RIVAL_IMAGE: [number, number] = [1024, 1536];

/**
 * Secousse de l'écran quand un coup touche : décalage maximal (fraction de l'écran) pour une puissance de 1,
 * et vitesse à laquelle elle s'éteint.
 */
const SHAKE = { amplitude: 0.006, decay: 9 };

/** Étincelle d'un coup qui touche : durée de vie et de croissance (secondes), taille (pixels de la toile), nombre à la fois. */
const SPARK = { seconds: 0.22, grow: 0.06, size: 520, pool: 4 };

/** Reflet sur le sol mouillé : le personnage retourné sous ses pieds, écrasé et presque transparent. */
const REFLECTION = { alpha: 0.2, squash: 0.5 };

/** Part du mouvement de garde conservée quand les animations sont réduites. */
const CALM_AMPLITUDE = 0.35;

/** Images fantômes laissées derrière le personnage pendant un dash : retard (secondes) et opacité. */
const DASH_GHOSTS: [delay: number, alpha: number][] = [
  [0.09, 0.14],
  [0.045, 0.3],
];

/** Poses chargées avant d'afficher le personnage : de quoi se tenir en garde et marcher. */
const ESSENTIAL_POSES: PoseName[] = ['guard', 'step', 'walk'];

/**
 * Poses dont chaque action a besoin. Elles sont téléchargées en arrière-plan, dans cet ordre, une fois
 * le personnage affiché ; une action n'est acceptée que lorsque toutes ses images sont arrivées.
 */
const ACTION_POSES = {
  dash: ['dashForward', 'dashBack'],
  crouch: ['crouchStep', 'crouch'],
  block: ['blockStep', 'block', 'crouchBlock'],
  jump: ['jumpStart', 'jumpRise', 'jumpPeak', 'jumpLand'],
  punch: ['jab1', 'jab2', 'jab3', 'jab4', 'jab5', 'jab6', 'punchChain1', 'punchChain2', 'punchMidHit', 'punchMidRecover', 'punchHeavyStart', 'punchHeavyHit', 'punchHeavyRecover', 'kickStart', 'kickHit'],
} satisfies Record<string, PoseName[]>;
type Action = keyof typeof ACTION_POSES;

/** Poses tenues en un seul calque, qui respirent d'un bloc. */
const HELD_POSES: PoseName[] = ['crouch', 'block', 'crouchBlock'];

/** Texture toujours présente dans Phaser, donnée aux images fantômes au repos. */
const BLANK_TEXTURE = '__DEFAULT';

interface Rival {
  state: RivalState;
  body: Phaser.GameObjects.Image;
  reflection: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
}

interface Spark {
  image: Phaser.GameObjects.Image;
  /** Point d'impact, en fraction de la largeur du stage, et hauteur au-dessus du sol (pixels de la toile). */
  x: number;
  height: number;
  power: number;
  age: number;
}

interface Hero {
  state: HeroState;
  atlases: HeroAtlases;
  body: HeroRig;
  reflection: HeroRig;
  shadow: Phaser.GameObjects.Image;
  ghosts: Phaser.GameObjects.Image[];
}

export class ArenaScene extends Phaser.Scene {
  private stage: Phaser.GameObjects.Shader | null = null;
  private weatherGraphics: Phaser.GameObjects.Graphics | null = null;
  private weather = new Weather();
  private hero: Hero | null = null;
  private rival: Rival | null = null;
  private sparks: Spark[] = [];
  /** Arrêt sur image restant quand un coup touche, en secondes : le combat se fige, le décor continue. */
  private stop = 0;
  /** Force de la secousse de l'écran, qui s'éteint d'elle-même. */
  private shake = 0;
  private atlases: HeroAtlases | null = null;
  private keyboard: ArenaKeyboard | null = null;
  private taps = new DoubleTap();
  /** Secondes écoulées depuis la création de la scène. */
  private clock = 0;
  private pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private nextBolt = 5;
  private boltAt = -99;
  private calm = false;
  private motionQuery: MediaQueryList | null = null;
  /** Cinématique d'entrée : son déroulé, et la texture et l'image où elle est recopiée à chaque image. */
  private cinematic = new Cinematic(CINEMATIC_TEXTS);
  private cinematicTexture: Phaser.Textures.CanvasTexture | null = null;
  private cinematicImage: Phaser.GameObjects.Image | null = null;

  constructor() {
    super('ArenaScene');
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.error(
        `[ArenaScene] Impossible de charger "${file.key}" (${file.url}). ` +
          'Le décor animé est remplacé par une version fixe.',
      );
    });
    this.load.image(BACKGROUND_KEY, STAGE_BACKGROUND_URL);
    this.load.image(DEPTH_KEY, STAGE_DEPTH_URL);
    for (const shot of CINEMATIC_SHOTS) {
      this.load.image(cinematicShotKey(shot), cinematicShotUrl(shot));
    }
    for (const pose of RIVAL_POSE_NAMES) {
      this.load.image(rivalPoseKey(pose), rivalPoseUrl(pose));
    }
  }

  create(): void {
    const webgl = this.game.renderer.type === Phaser.WEBGL;
    const hasBackground = this.textures.exists(BACKGROUND_KEY);

    if (webgl && hasBackground && this.textures.exists(DEPTH_KEY)) {
      this.addAnimatedStage();
    } else {
      // Sans WebGL ou sans la carte de profondeur : décor fixe et ligne de sol, comme avant.
      if (hasBackground) {
        this.addBackground();
      } else {
        this.addFallbackBackground();
      }
      this.addGroundLine();
    }

    this.addCinematic();

    if (!webgl) {
      console.warn('[ArenaScene] WebGL indisponible : rendu Canvas utilisé en secours, décor fixe.');
    }
  }

  override update(_time: number, deltaMs: number): void {
    // la cinématique suit le temps réel, même quand les images ralentissent
    this.updateCinematic(Math.min(0.25, deltaMs / 1000));
    if (!this.stage || !this.weatherGraphics) {
      return;
    }
    const delta = Math.min(0.05, deltaMs / 1000);
    this.clock += delta;
    const time = this.clock;
    const { width, height } = this.scale;

    const pointer = this.pointer;
    pointer.x += (pointer.targetX - pointer.x) * 0.06;
    pointer.y += (pointer.targetY - pointer.y) * 0.06;
    const camera = computeCamera(time, time * 1000, pointer, this.calm);
    // secousse d'impact : elle déplace tous les plans ensemble
    this.shake *= Math.exp(-delta * SHAKE.decay);
    if (!this.calm) {
      camera.ox += Math.sin(time * 97) * this.shake * SHAKE.amplitude;
      camera.oy += Math.cos(time * 83) * this.shake * SHAKE.amplitude * 0.6;
    }
    // arrêt sur image : le combat se fige un instant, le décor, la météo et les étincelles continuent
    const stopped = this.stop > 0;
    this.stop = Math.max(0, this.stop - delta);
    const fight = stopped ? 0 : delta;

    // éclair : un flash franc puis une réplique
    if (time > this.nextBolt) {
      this.boltAt = time;
      this.nextBolt = time + 7 + Math.random() * 9;
    }
    const since = time - this.boltAt;
    const bolt = this.calm ? 0 : Math.exp(-since * 7) + Math.exp(-((since - 0.2) ** 2) * 380) * 0.8;

    // métro : -1 quand il est hors champ, sinon sa position le long du viaduc
    const cycle = time % TRAIN_EVERY;
    const train = cycle < TRAIN_RUN ? (cycle / TRAIN_RUN) * 1.9 - 0.15 : -1;

    this.stage.setUniform('uT.value', time);
    this.stage.setUniform('uZoom.value', camera.zoom);
    this.stage.setUniform('uTrain.value', train);
    this.stage.setUniform('uCalm.value', this.calm ? 1 : 0);
    this.stage.setUniform('uBolt.value', bolt);
    this.stage.setUniform('uOff.value.x', -camera.ox);
    this.stage.setUniform('uOff.value.y', -camera.oy);

    if (this.rival) {
      this.rival.state.update(fight);
    }
    if (this.hero) {
      this.updateHero(this.hero, time, fight, camera);
    }
    if (this.hero && this.rival && !stopped) {
      this.resolveHits(this.hero, this.rival);
    }
    if (this.rival) {
      this.drawRival(this.rival, time, camera);
    }
    this.updateSparks(delta, camera);

    this.weather.draw(this.weatherGraphics, {
      time,
      delta,
      width,
      height,
      shift: -camera.ox * 0.5,
      calm: this.calm,
    });
  }

  /** Décor animé : parallaxe par carte de profondeur, ciel, écrans, lanternes, métro, brume, puis Moussa et la météo. */
  private addAnimatedStage(): void {
    const { width, height } = this.scale;
    const shader = new Phaser.Display.BaseShader(SHADER_KEY, STAGE_FRAGMENT, undefined, STAGE_UNIFORMS);
    this.stage = this.add
      .shader(shader, 0, 0, width, height, [BACKGROUND_KEY, DEPTH_KEY], STAGE_TEXTURE_DATA)
      .setOrigin(0);
    this.weatherGraphics = this.add.graphics().setDepth(WEATHER_DEPTH);
    this.addRival();
    void this.loadHero();

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.pointer.targetX = (pointer.x / width - 0.5) * 2;
      this.pointer.targetY = (pointer.y / height - 0.5) * 2;
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.pointer.targetX = 0;
      this.pointer.targetY = 0;
    });

    // « Réduire les animations » du système : plus d'éclairs ni de parasites, caméra fixe, météo allégée.
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motionQuery = query;
    this.calm = query.matches;
    query.addEventListener('change', this.onMotionChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.stopListening, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.stopListening, this);
  }

  /**
   * Charge Moussa sans retarder l'arène : d'abord de quoi se tenir en garde et marcher, puis, une fois
   * le personnage affiché, les poses des autres actions.
   */
  private async loadHero(): Promise<void> {
    const atlases = new HeroAtlases(this.textures);
    this.atlases = atlases;
    if (!(await atlases.load(ESSENTIAL_POSES)) || this.atlases !== atlases) {
      return;
    }
    this.addHero(atlases);
    for (const poses of Object.values(ACTION_POSES)) {
      if (this.atlases !== atlases) {
        return;
      }
      await atlases.load(poses);
    }
  }

  /** Moussa : reflet, ombre et personnage, plus le clavier et les boutons de l'interface. */
  private addHero(atlases: HeroAtlases): void {
    this.addShadowTexture();
    const reflection = new HeroRig(this, atlases, REFLECTION.alpha);
    reflection.container.setDepth(REFLECTION_DEPTH);
    const shadow = this.add.image(0, 0, SHADOW_KEY).setDepth(SHADOW_DEPTH);
    const body = new HeroRig(this, atlases);
    body.container.setDepth(HERO_DEPTH);
    const ghosts = DASH_GHOSTS.map(() =>
      this.add.image(0, 0, BLANK_TEXTURE).setOrigin(0).setDepth(GHOST_DEPTH).setVisible(false),
    );
    this.hero = { state: new HeroState(), atlases, body, reflection, shadow, ghosts };

    this.keyboard = new ArenaKeyboard({
      onTap: (direction, at) => this.tap(direction, at),
      onJump: () => this.jump(),
      onAttack: () => this.attack(),
    });
  }

  /** Ombre au sol, partagée par les deux combattants : un disque noir qui s'estompe vers le bord. */
  private addShadowTexture(): void {
    if (!this.textures.exists(SHADOW_KEY)) {
      // ombre au sol : un disque noir qui s'estompe vers le bord
      const size = 128;
      const canvas = this.textures.createCanvas(SHADOW_KEY, size, size);
      if (canvas) {
        const context = canvas.getContext();
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        for (let stop = 0; stop <= 10; stop++) {
          const radius = stop / 10;
          const k = Math.min(1, Math.max(0, (1 - radius) / 0.85));
          gradient.addColorStop(radius, `rgba(0,0,0,${k * k * (3 - 2 * k) * 0.6})`);
        }
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }
  }

  /**
   * Shigaraki : reflet, ombre et personnage, en garde à sa place. Ses images sont chargées avec le décor ; sans
   * elles, l'arène reste sans adversaire. Les étincelles des coups sont préparées en même temps.
   */
  private addRival(): void {
    if (!RIVAL_POSE_NAMES.every((pose) => this.textures.exists(rivalPoseKey(pose)))) {
      return;
    }
    this.addShadowTexture();
    const key = rivalPoseKey('guard');
    const reflection = this.add.image(0, 0, key).setDepth(REFLECTION_DEPTH).setAlpha(REFLECTION.alpha);
    const shadow = this.add.image(0, 0, SHADOW_KEY).setDepth(SHADOW_DEPTH);
    const body = this.add.image(0, 0, key).setDepth(RIVAL_DEPTH);
    this.rival = { state: new RivalState(), body, reflection, shadow };
    this.addSparkTexture();
    this.sparks = Array.from({ length: SPARK.pool }, () => ({
      image: this.add.image(0, 0, SPARK_KEY).setDepth(SPARK_DEPTH).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
      x: 0,
      height: 0,
      power: 0,
      age: SPARK.seconds,
    }));
  }

  /** Étincelle d'impact : une étoile à huit branches, cœur blanc, bords rouge et orangé, sur un halo. */
  private addSparkTexture(): void {
    if (this.textures.exists(SPARK_KEY)) {
      return;
    }
    const size = 256;
    const canvas = this.textures.createCanvas(SPARK_KEY, size, size);
    if (!canvas) {
      return;
    }
    const context = canvas.getContext();
    const center = size / 2;
    const glow = context.createRadialGradient(center, center, 0, center, center, center);
    glow.addColorStop(0, 'rgba(255, 240, 220, 0.9)');
    glow.addColorStop(0.25, 'rgba(255, 150, 70, 0.45)');
    glow.addColorStop(1, 'rgba(232, 38, 45, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, size, size);
    for (let ray = 0; ray < 8; ray++) {
      const angle = (ray / 8) * Math.PI * 2 + 0.2;
      const length = center * (ray % 2 === 0 ? 0.98 : 0.6);
      const width = ray % 2 === 0 ? 0.13 : 0.1;
      const gradient = context.createLinearGradient(center, center, center + Math.cos(angle) * length, center + Math.sin(angle) * length);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.45, 'rgba(255, 170, 80, 0.9)');
      gradient.addColorStop(1, 'rgba(232, 38, 45, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(center + Math.cos(angle - width) * size * 0.04, center + Math.sin(angle - width) * size * 0.04);
      context.lineTo(center + Math.cos(angle) * length, center + Math.sin(angle) * length);
      context.lineTo(center + Math.cos(angle + width) * size * 0.04, center + Math.sin(angle + width) * size * 0.04);
      context.closePath();
      context.fill();
    }
    canvas.refresh();
  }

  /** Vrai si les images de cette action sont arrivées, et que la cinématique d'entrée laisse jouer. */
  private can(action: Action): boolean {
    return !this.cinematic.locked && (this.hero?.atlases.has(...ACTION_POSES[action]) ?? false);
  }

  /**
   * Cinématique d'entrée : elle se dessine en Canvas 2D dans une texture de la taille de la scène, affichée
   * par-dessus tout. Elle démarre dès que ses plans sont chargés ; sans eux, l'arène s'ouvre directement.
   */
  private addCinematic(): void {
    const { width, height } = this.scale;
    const texture = this.textures.exists(CINEMATIC_KEY) ? null : this.textures.createCanvas(CINEMATIC_KEY, width, height);
    if (!texture) {
      return;
    }
    this.cinematicTexture = texture;
    this.cinematicImage = this.add.image(0, 0, CINEMATIC_KEY).setOrigin(0).setDepth(CINEMATIC_DEPTH);
    this.cinematic.setImages(
      CINEMATIC_SHOTS.map((shot) => {
        const key = cinematicShotKey(shot);
        return this.textures.exists(key) ? (this.textures.get(key).getSourceImage() as HTMLImageElement) : null;
      }),
    );
    void Cinematic.loadFonts();
    this.cinematic.start();
    window.addEventListener('keydown', this.onCinematicKey);
  }

  /** Échap passe les plans de la cinématique. */
  private onCinematicKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.cinematic.covering) {
      this.cinematic.skip();
    }
  };

  /** Fait avancer la cinématique et recopie son dessin dans la texture ; une dernière fois pour l'effacer à la fin. */
  private updateCinematic(delta: number): void {
    const texture = this.cinematicTexture;
    if (!texture || !this.cinematicImage) {
      return;
    }
    const wasPlaying = this.cinematic.playing;
    this.cinematic.update(delta);
    const playing = this.cinematic.playing;
    this.cinematicImage.setVisible(playing);
    if (!playing && !wasPlaying) {
      return;
    }
    this.cinematic.draw(texture.getContext(), { time: this.clock, delta, width: texture.width, height: texture.height }, this.calm);
    texture.refresh();
  }

  /** Un appui sur une direction : le second appui rapproché dans le même sens lance un dash. */
  private tap(direction: number, at: number): void {
    if (this.taps.tap(direction, at) && this.can('dash')) {
      this.hero?.state.dash(direction);
    }
  }

  private jump(): void {
    if (this.can('jump')) {
      // une direction tenue au moment de l'appui donne un saut avant ou arrière
      this.hero?.state.jump(this.walkDirection());
    }
  }

  /** Touche d'attaque : un appui pour le coup léger, un autre pendant le coup pour enchaîner. */
  private attack(): void {
    if (this.can('punch')) {
      this.hero?.state.attack();
    }
  }

  /** Déplacement demandé au clavier. */
  private walkDirection(): number {
    if (this.cinematic.locked) {
      return 0;
    }
    return this.keyboard?.direction ?? 0;
  }

  /** Vrai tant qu'une touche demande l'accroupi ou la parade, et que ses images sont là. */
  private holds(action: 'crouch' | 'block'): boolean {
    return this.can(action) && (this.keyboard?.[action] ?? false);
  }

  private updateHero(hero: Hero, time: number, delta: number, camera: StageCamera): void {
    const { width, height } = this.scale;
    hero.state.update(delta, this.walkDirection(), height / width, this.holds('crouch'), this.holds('block'));

    const jump = hero.state.pose === 'jump' ? hero.state.jumpFrame() : null;
    const lift = jump ? jump.lift : 0;
    const pose = hero.state.illustration;
    const amplitude = this.calm ? CALM_AMPLITUDE : 1;
    let matrices: Affine[] | null = null;
    if (pose === 'guard') {
      matrices = guardMatrices(time, amplitude);
    } else if (pose === 'walk') {
      matrices = walkMatrices(hero.state.phase);
    } else if (HELD_POSES.includes(pose)) {
      matrices = [heldMatrix(POSES[pose].anchor, time, amplitude)];
    } else if (jump) {
      // le dessin du saut est déformé en continu autour de ses pieds
      matrices = [scaleAbout(feetOf(pose), 1 + (jump.sx - 1) * amplitude, 1 + (jump.sy - 1) * amplitude)];
    }
    const ribbonPhase = time * (pose === 'walk' ? 7 : 2.4);
    hero.body.show(pose, matrices, ribbonPhase, amplitude);
    hero.reflection.show(pose, matrices, ribbonPhase, amplitude);

    // même caméra que le décor : zoom autour du centre et parallaxe du plan du sol
    const groundX = ((hero.state.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5) * width;
    const groundY = ((PLACEMENT.y + PLACEMENT.depth * camera.oy - 0.5) * camera.zoom + 0.5) * height;
    const scale = (PLACEMENT.scale * camera.zoom * height) / CANVAS[1];
    const left = groundX - GROUND[0] * scale;
    const top = groundY - GROUND[1] * scale;
    hero.body.container.setPosition(left, top - lift * scale).setScale(scale);
    // en l'air, le reflet s'éloigne des pieds et s'estompe, et l'ombre rétrécit
    const air = lift / JUMP.height;
    hero.reflection.container
      .setPosition(left, groundY + (GROUND[1] + lift) * scale * REFLECTION.squash)
      .setScale(scale, -scale * REFLECTION.squash);
    hero.reflection.setFade(1 - 0.6 * air);
    const tall = scale * CANVAS[1];
    const shrink = 1 - 0.45 * air;
    hero.shadow
      .setPosition(groundX, groundY - tall * 0.006)
      .setDisplaySize(tall * 0.313 * shrink, tall * 0.031 * shrink);

    // pendant un dash, la pose est redessinée, de plus en plus transparente, à ses positions précédentes
    const dashing = hero.state.pose === 'dash' && !this.calm;
    hero.ghosts.forEach((ghost, index) => {
      const [delay, alpha] = DASH_GHOSTS[index] ?? [0, 0];
      const elapsed = hero.state.dashing.time;
      if (!dashing || elapsed <= delay) {
        // au repos, l'image ne garde pas de référence à un atlas qui peut être retiré de la mémoire vidéo
        if (ghost.visible) {
          ghost.setTexture(BLANK_TEXTURE).setVisible(false);
        }
        return;
      }
      const placement = singleLayerPlacement(pose);
      const shift = (hero.state.dashX(elapsed - delay) - hero.state.x) * camera.zoom * width;
      ghost
        .setTexture(placement.key, placement.frame)
        .setPosition(left + shift + placement.x * scale, top + placement.y * scale)
        .setScale(placement.scale * scale)
        .setAlpha(alpha)
        .setVisible(true);
    });
  }

  /**
   * Moussa ne traverse pas Shigaraki ; un coup qui l'atteint le fait réagir : coup reçu, inclinaison, arrêt sur
   * image, secousse et étincelle au point d'impact.
   */
  private resolveHits(hero: Hero, rival: Rival): void {
    const { width, height } = this.scale;
    // largeur d'un pixel de la toile, en fraction de la largeur du stage
    const pixel = (PLACEMENT.scale / CANVAS[1]) * (height / width);
    hero.state.wall = rival.state.x - RIVAL_BODY.gap * pixel;
    const surface = rival.state.x - RIVAL_BODY.surface * pixel;
    const strike = hero.state.strike(pixel);
    if (!strike || strike.x < surface) {
      return;
    }
    hero.state.land();
    rival.state.hit(strike.power);
    this.stop = strike.stop * (this.calm ? 0.5 : 1);
    this.shake = Math.max(this.shake, strike.power);
    const spark = this.sparks.reduce((oldest, other) => (other.age > oldest.age ? other : oldest));
    Object.assign(spark, { x: surface, height: strike.height, power: strike.power, age: 0 });
  }

  /** Shigaraki, son reflet et son ombre, sur le même plan du sol et avec la même caméra que Moussa. */
  private drawRival(rival: Rival, time: number, camera: StageCamera): void {
    const { width, height } = this.scale;
    const { state } = rival;
    const pose = RIVAL_POSES[state.pose];
    const key = rivalPoseKey(state.pose);
    const amplitude = this.calm ? CALM_AMPLITUDE : 1;
    const groundX = ((state.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5) * width;
    const groundY = ((PLACEMENT.y + PLACEMENT.depth * camera.oy - 0.5) * camera.zoom + 0.5) * height;
    const unit = (PLACEMENT.scale * camera.zoom * height) / CANVAS[1];
    const scaleX = pose.scale * unit;
    // il respire en s'étirant depuis le sol ; touché, il penche en arrière, pieds fixes (une rotation autour du
    // point posé au sol, très proche de l'inclinaison du lab pour de si petits angles)
    const scaleY = pose.scale * state.breath(time, amplitude) * unit;
    const lean = Math.atan(state.lean * amplitude);
    const origin: [number, number] = [pose.ground[0] / RIVAL_IMAGE[0], pose.ground[1] / RIVAL_IMAGE[1]];
    rival.body
      .setTexture(key)
      .setOrigin(...origin)
      .setPosition(groundX, groundY)
      .setScale(scaleX, scaleY)
      .setRotation(lean);
    // reflet : le même dessin retourné et écrasé sous ses pieds
    rival.reflection
      .setTexture(key)
      .setOrigin(...origin)
      .setPosition(groundX, groundY)
      .setScale(scaleX, -scaleY * REFLECTION.squash)
      .setRotation(-lean);
    const tall = unit * CANVAS[1];
    rival.shadow.setPosition(groundX, groundY - tall * 0.006).setDisplaySize(tall * 0.34, tall * 0.033);
  }

  /** Les étincelles grossissent d'un coup puis s'éteignent, même pendant l'arrêt sur image. */
  private updateSparks(delta: number, camera: StageCamera): void {
    const { width, height } = this.scale;
    const unit = (PLACEMENT.scale * camera.zoom * height) / CANVAS[1];
    const groundY = ((PLACEMENT.y + PLACEMENT.depth * camera.oy - 0.5) * camera.zoom + 0.5) * height;
    for (const spark of this.sparks) {
      spark.age += delta;
      const k = spark.age / SPARK.seconds;
      if (k >= 1) {
        spark.image.setVisible(false);
        continue;
      }
      const grow = 1 - (1 - Math.min(1, spark.age / SPARK.grow)) ** 3;
      const size = SPARK.size * (0.55 + 0.45 * spark.power) * (0.5 + 0.6 * grow) * (this.calm ? 0.7 : 1);
      spark.image
        .setVisible(true)
        .setPosition(((spark.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5) * width, groundY - spark.height * unit)
        .setDisplaySize(size * unit, size * unit)
        .setRotation(spark.power * 3 + spark.x * 40)
        .setAlpha(1 - k * k);
    }
  }

  private onMotionChange = (event: MediaQueryListEvent): void => {
    this.calm = event.matches;
  };

  private stopListening(): void {
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    window.removeEventListener('keydown', this.onCinematicKey);
    this.keyboard?.destroy();
    this.keyboard = null;
    this.atlases?.close();
    this.atlases = null;
    this.motionQuery = null;
  }

  /** Décor en mode « cover » : remplit la scène sans déformer l'image. */
  private addBackground(): void {
    const { width, height } = this.scale;
    const background = this.add.image(width / 2, height / 2, BACKGROUND_KEY);
    background.setScale(Math.max(width / background.width, height / background.height));
  }

  /** Fond temporaire sobre, utilisé uniquement si le décor n'a pas pu être chargé. */
  private addFallbackBackground(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, GROUND_Y, COLOR_NIGHT_BLUE).setOrigin(0);
    this.add.rectangle(0, GROUND_Y, width, height - GROUND_Y, COLOR_NIGHT).setOrigin(0);
  }

  private addGroundLine(): void {
    const { width } = this.scale;
    const line = this.add.graphics();
    line.lineStyle(6, COLOR_RED, 0.25);
    line.lineBetween(0, GROUND_Y, width, GROUND_Y);
    line.lineStyle(2, COLOR_RED, 0.9);
    line.lineBetween(0, GROUND_Y, width, GROUND_Y);
  }
}
