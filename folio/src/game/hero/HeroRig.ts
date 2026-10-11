import Phaser from 'phaser';
import type { PoseName } from './heroState';
import { POSES } from './poseData';
import type { PoseLayer } from './poseData';
import { BENDS } from './poseRig';
import type { Affine, Bend } from './poseRig';
import { RIBBON_FRAGMENT, RIBBON_MARGIN, RIBBON_TEXTURE_DATA, ribbonUniforms } from './shaders';

export const POSE_NAMES: PoseName[] = ['guard', 'step', 'walk', 'dashForward', 'dashBack'];

/** Point de la toile posé sur le sol : le milieu des appuis de la garde. Les autres poses s'y alignent. */
export const GROUND = POSES.guard.anchor;

/** Point de chaque pose posé sur ce point du sol, dans sa propre toile. */
const FEET: Record<PoseName, [number, number]> = {
  guard: POSES.guard.anchor,
  step: POSES.step.anchor,
  dashForward: POSES.dashForward.anchor,
  dashBack: POSES.dashBack.anchor,
  // en marche, c'est la hanche qui est à l'aplomb du point d'appui
  walk: [POSES.walk.joints.hip_near[0], POSES.walk.anchor[1]],
};

/**
 * Agrandissement de chaque pose autour de ses pieds, pour que la tête garde la taille de celle de la garde.
 * Les illustrations de dash sont dessinées plus petit : valeurs mesurées sur la hauteur de la tête.
 */
const POSE_SCALE: Record<PoseName, number> = { guard: 1, step: 1, walk: 1, dashForward: 1.07, dashBack: 1.15 };

/** Nom de l'image d'un calque dans l'atlas de sa pose. */
const layerFrame = (layer: PoseLayer): string => `layer-${layer.name}`;

/**
 * Où dessiner, dans la toile, une pose faite d'un seul calque (pose intermédiaire, dashs) : texture, image,
 * coin haut gauche et échelle. Sert aux images fantômes du dash, dessinées hors du rig.
 */
export function singleLayerPlacement(name: PoseName) {
  const layer = POSES[name].layers[0];
  const scale = POSE_SCALE[name];
  return {
    key: poseTextureKey(name),
    frame: layerFrame(layer),
    x: GROUND[0] + (layer.box[0] - FEET[name][0]) * scale,
    y: GROUND[1] + (layer.box[1] - FEET[name][1]) * scale,
    scale,
  };
}

/** Clé de texture Phaser de l'atlas d'une pose. */
export const poseTextureKey = (pose: PoseName): string => `hero-${pose}`;

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

interface LayerView {
  object: Phaser.GameObjects.Image | Phaser.GameObjects.Shader;
  /** Coin haut gauche du quad au repos, en pixels de la toile. */
  origin: [number, number];
  /** Présent pour les rubans, dessinés par le shader d'ondulation. */
  ribbon?: { shader: Phaser.GameObjects.Shader; bend: Bend };
}

/**
 * Le personnage dessiné une fois : un groupe par pose, un objet Phaser par calque, du fond vers le
 * premier plan. Les calques rigides sont des images découpées dans l'atlas ; les rubans passent par
 * un shader qui les fait onduler. Tout est exprimé en pixels de la toile (1024 × 1536) : c'est le
 * conteneur qui porte la mise à l'échelle et la position à l'écran.
 */
export class HeroRig {
  readonly container: Phaser.GameObjects.Container;
  private groups = {} as Record<PoseName, Phaser.GameObjects.Container>;
  private views = {} as Record<PoseName, LayerView[]>;

  /** `alpha` : opacité de l'ensemble, inférieure à 1 pour le reflet. */
  constructor(scene: Phaser.Scene, alpha = 1) {
    this.container = scene.add.container(0, 0).setAlpha(alpha);
    for (const name of POSE_NAMES) {
      const pose = POSES[name];
      const key = poseTextureKey(name);
      const texture = scene.textures.get(key);
      const bends: Record<string, Bend> = BENDS[name];
      // la pose est agrandie autour de ses pieds, puis ses pieds sont posés sur le point du sol
      const scale = POSE_SCALE[name];
      const group = scene.add
        .container(GROUND[0] - FEET[name][0] * scale, GROUND[1] - FEET[name][1] * scale)
        .setScale(scale)
        .setVisible(false);
      this.views[name] = pose.layers.map((layer) => {
        const bend = bends[layer.name];
        const view = bend
          ? this.addRibbon(scene, key, layer, bend, pose.atlasSize, alpha)
          : this.addImage(scene, texture, layer);
        group.add(view.object);
        return view;
      });
      this.groups[name] = group;
      this.container.add(group);
    }
  }

  private addImage(scene: Phaser.Scene, texture: Phaser.Textures.Texture, layer: PoseLayer): LayerView {
    const [x, y, width, height] = layer.box;
    const frame = layerFrame(layer);
    if (!texture.has(frame)) {
      texture.add(frame, 0, layer.atlas[0], layer.atlas[1], width, height);
    }
    return { object: scene.add.image(0, 0, texture.key, frame).setOrigin(0), origin: [x, y] };
  }

  private addRibbon(
    scene: Phaser.Scene,
    key: string,
    layer: PoseLayer,
    bend: Bend,
    atlasSize: [number, number],
    alpha: number,
  ): LayerView {
    const [x, y, width, height] = layer.box;
    const base = new Phaser.Display.BaseShader(
      `${key}-${layer.name}`,
      RIBBON_FRAGMENT,
      undefined,
      ribbonUniforms(layer, bend, atlasSize, alpha),
    );
    const shader = scene.add
      .shader(base, 0, 0, width + 2 * RIBBON_MARGIN, height + 2 * RIBBON_MARGIN, [key], RIBBON_TEXTURE_DATA)
      .setOrigin(0);
    return { object: shader, origin: [x - RIBBON_MARGIN, y - RIBBON_MARGIN], ribbon: { shader, bend } };
  }

  /**
   * Affiche une pose.
   *
   * @param matrices une transformation par calque (voir `poseRig.ts`), ou `null` pour la pose au repos
   * @param ribbonPhase phase de l'ondulation des rubans, en radians
   * @param amplitude 1 pour le mouvement prévu, moins quand les animations sont réduites
   */
  show(
    name: PoseName,
    matrices: Affine[] | null,
    ribbonPhase: number,
    amplitude: number,
  ): void {
    for (const other of POSE_NAMES) {
      this.groups[other].setVisible(other === name);
    }
    this.views[name].forEach((view, index) => {
      // Les transformations du rig sont des rotations et des mises à l'échelle, sans cisaillement :
      // elles se décomposent exactement en position, rotation et échelle Phaser.
      const [a, b, c, d, e, f] = matrices?.[index] ?? IDENTITY;
      const [x, y] = view.origin;
      const scaleX = Math.hypot(a, b);
      view.object
        .setPosition(a * x + c * y + e, b * x + d * y + f)
        .setRotation(Math.atan2(b, a))
        .setScale(scaleX, (a * d - b * c) / scaleX);
      if (view.ribbon) {
        view.ribbon.shader.setUniform('uBend.value.x', view.ribbon.bend.amplitude * amplitude);
        view.ribbon.shader.setUniform('uBend.value.z', ribbonPhase + index);
      }
    });
  }
}
