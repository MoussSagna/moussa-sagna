import Phaser from 'phaser';
import { STAGE_BACKGROUND_URL, STAGE_DEPTH_URL, heroPoseUrl } from '../../assets';
import { WALK_REGISTRY_KEY } from '../controls';
import { GROUND, HeroRig, POSE_NAMES, poseTextureKey, singleLayerPlacement } from '../hero/HeroRig';
import { DoubleTap, HeroState, PLACEMENT } from '../hero/heroState';
import { CANVAS } from '../hero/poseData';
import { guardMatrices, walkMatrices } from '../hero/poseRig';
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
const COLOR_RED = 0xe8262d;

/** Le métro traverse le viaduc en `TRAIN_RUN` secondes, toutes les `TRAIN_EVERY` secondes. */
const TRAIN_EVERY = 17;
const TRAIN_RUN = 7;

/** Ordre des plans : décor, reflet, ombre, images fantômes du dash, personnage, puis la météo devant tout. */
const REFLECTION_DEPTH = 1;
const SHADOW_DEPTH = 2;
const GHOST_DEPTH = 3;
const HERO_DEPTH = 4;
const WEATHER_DEPTH = 100;

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

interface Hero {
  state: HeroState;
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
  private keys: Record<string, Phaser.Input.Keyboard.Key> | null = null;
  private taps = new DoubleTap();
  /** Secondes écoulées depuis la création de la scène. */
  private clock = 0;
  private pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private nextBolt = 5;
  private boltAt = -99;
  private calm = false;
  private motionQuery: MediaQueryList | null = null;

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
    for (const pose of POSE_NAMES) {
      this.load.image(poseTextureKey(pose), heroPoseUrl(pose));
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

    if (!webgl) {
      console.warn('[ArenaScene] WebGL indisponible : rendu Canvas utilisé en secours, décor fixe.');
    }
  }

  override update(_time: number, deltaMs: number): void {
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
    if (POSE_NAMES.every((pose) => this.textures.exists(poseTextureKey(pose)))) {
      this.addHero();
    }

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

  /** Moussa : reflet, ombre et personnage, plus les touches de déplacement. */
  private addHero(): void {
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
    const reflection = new HeroRig(this, REFLECTION.alpha);
    reflection.container.setDepth(REFLECTION_DEPTH);
    const shadow = this.add.image(0, 0, SHADOW_KEY).setDepth(SHADOW_DEPTH);
    const body = new HeroRig(this);
    body.container.setDepth(HERO_DEPTH);
    const ghost = singleLayerPlacement('dashForward');
    const ghosts = DASH_GHOSTS.map(() =>
      this.add.image(0, 0, ghost.key, ghost.frame).setOrigin(0).setDepth(GHOST_DEPTH).setVisible(false),
    );
    this.hero = { state: new HeroState(), body, reflection, shadow, ghosts };

    // Flèches, ou Q et D (A pour les claviers QWERTY). Sans capture : la page garde ses raccourcis.
    const keys = this.input.keyboard?.addKeys('LEFT,RIGHT,Q,A,D', false);
    this.keys = keys ? (keys as Record<string, Phaser.Input.Keyboard.Key>) : null;
    // Chaque appui (pas la répétition d'une touche maintenue) compte pour le double appui du dash.
    for (const [name, key] of Object.entries(this.keys ?? {})) {
      const direction = name === 'RIGHT' || name === 'D' ? 1 : -1;
      key.on(Phaser.Input.Keyboard.Events.DOWN, () => this.tap(direction));
    }
    this.registry.events.on(`changedata-${WALK_REGISTRY_KEY}`, this.onWalkButton, this);
  }

  /** Les boutons de l'interface passent par le registre : un passage à 1 ou -1 est un appui. */
  private onWalkButton(_parent: unknown, value: unknown): void {
    if (value === 1 || value === -1) {
      this.tap(value);
    }
  }

  /** Un appui sur une direction : le second appui rapproché dans le même sens lance un dash. */
  private tap(direction: number): void {
    if (this.taps.tap(direction, performance.now())) {
      this.hero?.state.dash(direction);
    }
  }

  /** Déplacement demandé : le clavier d'abord, sinon les boutons de l'interface. */
  private walkDirection(): number {
    const keys = this.keys;
    let direction = 0;
    if (keys) {
      if (keys.RIGHT?.isDown || keys.D?.isDown) {
        direction += 1;
      }
      if (keys.LEFT?.isDown || keys.Q?.isDown || keys.A?.isDown) {
        direction -= 1;
      }
    }
    if (direction !== 0) {
      return direction;
    }
    const held: unknown = this.registry.get(WALK_REGISTRY_KEY);
    return held === 1 || held === -1 ? held : 0;
  }

  private updateHero(hero: Hero, time: number, delta: number, camera: StageCamera): void {
    const { width, height } = this.scale;
    hero.state.update(delta, this.walkDirection(), height / width);

    const pose = hero.state.illustration;
    const amplitude = this.calm ? CALM_AMPLITUDE : 1;
    const matrices =
      pose === 'guard' ? guardMatrices(time, amplitude) : pose === 'walk' ? walkMatrices(hero.state.phase) : null;
    const ribbonPhase = time * (pose === 'walk' ? 7 : 2.4);
    hero.body.show(pose, matrices, ribbonPhase, amplitude);
    hero.reflection.show(pose, matrices, ribbonPhase, amplitude);

    // même caméra que le décor : zoom autour du centre et parallaxe du plan du sol
    const groundX = ((hero.state.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5) * width;
    const groundY = ((PLACEMENT.y + PLACEMENT.depth * camera.oy - 0.5) * camera.zoom + 0.5) * height;
    const scale = (PLACEMENT.scale * camera.zoom * height) / CANVAS[1];
    const left = groundX - GROUND[0] * scale;
    hero.body.container.setPosition(left, groundY - GROUND[1] * scale).setScale(scale);
    hero.reflection.container
      .setPosition(left, groundY + GROUND[1] * scale * REFLECTION.squash)
      .setScale(scale, -scale * REFLECTION.squash);
    const tall = scale * CANVAS[1];
    hero.shadow.setPosition(groundX, groundY - tall * 0.006).setDisplaySize(tall * 0.313, tall * 0.031);

    // pendant un dash, la pose est redessinée, de plus en plus transparente, à ses positions précédentes
    const dashing = hero.state.pose === 'dash' && !this.calm;
    const top = groundY - GROUND[1] * scale;
    hero.ghosts.forEach((ghost, index) => {
      const [delay, alpha] = DASH_GHOSTS[index] ?? [0, 0];
      const elapsed = hero.state.dashing.time;
      if (!dashing || elapsed <= delay) {
        ghost.setVisible(false);
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
    this.registry.events.off(`changedata-${WALK_REGISTRY_KEY}`, this.onWalkButton, this);
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
