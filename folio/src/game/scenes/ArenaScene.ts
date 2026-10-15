import Phaser from 'phaser';
import { STAGE_BACKGROUND_URL, STAGE_DEPTH_URL, cinematicShotUrl } from '../../assets';
import { CINEMATIC_TEXTS } from '../../data/cinematic';
import { CINEMATIC_SHOTS, Cinematic } from '../cinematic/cinematic';
import { CONTROLS } from '../controls';
import { HeroAtlases } from '../hero/HeroAtlases';
import { GROUND, HeroRig, feetOf, singleLayerPlacement } from '../hero/HeroRig';
import { DoubleTap, HeroState, JUMP, PLACEMENT } from '../hero/heroState';
import type { PoseName } from '../hero/heroState';
import { CANVAS, POSES } from '../hero/poseData';
import { guardMatrices, heldMatrix, scaleAbout, walkMatrices } from '../hero/poseRig';
import type { Affine } from '../hero/poseRig';
import { ArenaKeyboard } from '../input';
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
const HERO_DEPTH = 4;
const WEATHER_DEPTH = 100;
/** La cinématique d'entrée recouvre tout, météo comprise. */
const CINEMATIC_DEPTH = 200;
const CINEMATIC_KEY = 'arena-cinematic';
const cinematicShotKey = (shot: string): string => `cinematic-${shot}`;

const SHADOW_KEY = 'hero-shadow';

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
  punch: ['punchStart', 'punchHit', 'punchChain1', 'punchChain2', 'punchMidHit', 'punchMidRecover', 'punchHeavyStart', 'punchHeavyHit', 'punchHeavyRecover', 'kickStart', 'kickHit'],
} satisfies Record<string, PoseName[]>;
type Action = keyof typeof ACTION_POSES;

/** Poses tenues en un seul calque, qui respirent d'un bloc. */
const HELD_POSES: PoseName[] = ['crouch', 'block', 'crouchBlock'];

/** Texture toujours présente dans Phaser, donnée aux images fantômes au repos. */
const BLANK_TEXTURE = '__DEFAULT';

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

    if (this.hero) {
      this.updateHero(this.hero, time, delta, camera);
    }

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
    this.registry.events.on(`changedata-${CONTROLS.walk}`, this.onWalkButton, this);
    this.registry.events.on(`changedata-${CONTROLS.jump}`, this.jump, this);
    this.registry.events.on(`changedata-${CONTROLS.attack}`, this.attack, this);
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
    this.registry.events.on(`changedata-${CONTROLS.skipCinematic}`, this.skipCinematic, this);
    this.registry.events.on(`changedata-${CONTROLS.replayCinematic}`, this.replayCinematic, this);
    window.addEventListener('keydown', this.onCinematicKey);
  }

  private skipCinematic(): void {
    this.cinematic.skip();
  }

  private replayCinematic(): void {
    this.cinematic.start();
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

  /** Les boutons de l'interface passent par le registre : un passage à 1 ou -1 est un appui. */
  private onWalkButton(_parent: unknown, value: unknown): void {
    if (value === 1 || value === -1) {
      this.tap(value, performance.now());
    }
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

  /** Déplacement demandé : le clavier d'abord, sinon les boutons de l'interface. */
  private walkDirection(): number {
    if (this.cinematic.locked) {
      return 0;
    }
    const direction = this.keyboard?.direction ?? 0;
    if (direction !== 0) {
      return direction;
    }
    const held: unknown = this.registry.get(CONTROLS.walk);
    return held === 1 || held === -1 ? held : 0;
  }

  /** Vrai tant qu'une touche ou un bouton demande l'accroupi ou la parade, et que ses images sont là. */
  private holds(action: 'crouch' | 'block'): boolean {
    return this.can(action) && ((this.keyboard?.[action] ?? false) || this.registry.get(CONTROLS[action]) === true);
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

  private onMotionChange = (event: MediaQueryListEvent): void => {
    this.calm = event.matches;
  };

  private stopListening(): void {
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    this.registry.events.off(`changedata-${CONTROLS.walk}`, this.onWalkButton, this);
    this.registry.events.off(`changedata-${CONTROLS.jump}`, this.jump, this);
    this.registry.events.off(`changedata-${CONTROLS.attack}`, this.attack, this);
    this.registry.events.off(`changedata-${CONTROLS.skipCinematic}`, this.skipCinematic, this);
    this.registry.events.off(`changedata-${CONTROLS.replayCinematic}`, this.replayCinematic, this);
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
