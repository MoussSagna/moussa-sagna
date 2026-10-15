import Phaser from 'phaser';
import { PINNED, layerFrame, poseTextureKey } from './HeroAtlases';
import type { HeroAtlases } from './HeroAtlases';
import type { PoseName } from './heroState';
import { POSES } from './poseData';
import type { PoseLayer } from './poseData';
import { BENDS } from './poseRig';
import type { Affine, Bend } from './poseRig';
import { RIBBON_FRAGMENT, RIBBON_MARGIN, RIBBON_TEXTURE_DATA, ribbonUniforms } from './shaders';

export const POSE_NAMES = Object.keys(POSES) as PoseName[];

/** Point de la toile posé sur le sol : le milieu des appuis de la garde. Les autres poses s'y alignent. */
export const GROUND = POSES.guard.anchor;

/** Point d'une pose posé sur ce point du sol, dans sa propre toile. */
export function feetOf(name: PoseName): [number, number] {
  // en marche, c'est la hanche qui est à l'aplomb du point d'appui
  return name === 'walk' ? [POSES.walk.joints.hip_near[0], POSES.walk.anchor[1]] : POSES[name].anchor;
}

/**
 * Agrandissement d'une pose autour de ses pieds, pour que la tête garde la taille de celle de la garde.
 * Certaines illustrations sont dessinées plus petit ou plus grand : valeurs mesurées sur la hauteur de la
 * tête. Les poses absentes de la liste sont à l'échelle 1.
 */
const POSE_SCALE: Partial<Record<PoseName, number>> = { dashForward: 1.07, dashBack: 1.15, jumpPeak: 0.93, kickStart: 1.07, kickHit: 1.12 };

/** Poses dessinées par le rig articulé (plusieurs calques animés séparément, rubans ondulés). */
type RiggedPose = 'guard' | 'walk';
const isRigged = (name: PoseName): name is RiggedPose => PINNED.includes(name);

/** Texture toujours présente dans Phaser, donnée aux images inutilisées pour qu'aucune ne pointe vers un atlas retiré. */
const BLANK_TEXTURE = '__DEFAULT';

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/** Nombre d'images nécessaires pour la pose simple qui a le plus de calques. */
const FLAT_LAYERS = Math.max(...POSE_NAMES.filter((name) => !isRigged(name)).map((name) => POSES[name].layers.length));

/** Position et échelle du groupe d'une pose : agrandie autour de ses pieds, puis ses pieds posés sur le point du sol. */
function poseFrame(name: PoseName): { x: number; y: number; scale: number } {
  const scale = POSE_SCALE[name] ?? 1;
  const feet = feetOf(name);
  return { x: GROUND[0] - feet[0] * scale, y: GROUND[1] - feet[1] * scale, scale };
}

/**
 * Où dessiner, dans la toile, une pose faite d'un seul calque : texture, image, coin haut gauche et
 * échelle. Sert aux images fantômes du dash, dessinées hors du rig.
 */
export function singleLayerPlacement(name: PoseName) {
  const layer = POSES[name].layers[0];
  const frame = poseFrame(name);
  return {
    key: poseTextureKey(name),
    frame: layer ? layerFrame(layer) : '',
    x: frame.x + (layer?.box[0] ?? 0) * frame.scale,
    y: frame.y + (layer?.box[1] ?? 0) * frame.scale,
    scale: frame.scale,
  };
}

/** Décompose une transformation sans cisaillement en position, rotation et échelle Phaser, et l'applique. */
function place(
  object: Phaser.GameObjects.Image | Phaser.GameObjects.Shader,
  matrix: Affine,
  origin: [number, number],
): void {
  const [a, b, c, d, e, f] = matrix;
  const [x, y] = origin;
  const scaleX = Math.hypot(a, b);
  object
    .setPosition(a * x + c * y + e, b * x + d * y + f)
    .setRotation(Math.atan2(b, a))
    .setScale(scaleX, (a * d - b * c) / scaleX);
}

interface LayerView {
  object: Phaser.GameObjects.Image | Phaser.GameObjects.Shader;
  /** Coin haut gauche du quad au repos, en pixels de la toile. */
  origin: [number, number];
  /** Présent pour les rubans, dessinés par le shader d'ondulation. */
  ribbon?: { shader: Phaser.GameObjects.Shader; bend: Bend };
}

/**
 * Le personnage dessiné une fois. Tout est exprimé en pixels de la toile (1024 × 1536) : c'est le
 * conteneur qui porte la mise à l'échelle et la position à l'écran.
 *
 * - La garde et la marche ont chacune leur groupe : un objet Phaser par calque, du fond vers le premier
 *   plan, des images pour les calques rigides et un shader pour les rubans qui ondulent.
 * - Toutes les autres poses sont de simples images sans rubans animés. Elles partagent quelques images
 *   dont la texture change avec la pose, ce qui permet de retirer leurs atlas de la mémoire vidéo.
 */
export class HeroRig {
  readonly container: Phaser.GameObjects.Container;
  private atlases: HeroAtlases;
  private rigged = {} as Record<RiggedPose, { group: Phaser.GameObjects.Container; views: LayerView[] }>;
  private flat: { group: Phaser.GameObjects.Container; images: Phaser.GameObjects.Image[] };
  private alpha: number;

  /** `alpha` : opacité de l'ensemble, inférieure à 1 pour le reflet. */
  constructor(scene: Phaser.Scene, atlases: HeroAtlases, alpha = 1) {
    this.atlases = atlases;
    this.alpha = alpha;
    this.container = scene.add.container(0, 0).setAlpha(alpha);

    for (const name of PINNED) {
      if (!isRigged(name)) {
        continue;
      }
      atlases.use(name);
      const pose = POSES[name];
      const key = poseTextureKey(name);
      const bends: Record<string, Bend> = BENDS[name];
      const frame = poseFrame(name);
      const group = scene.add.container(frame.x, frame.y).setScale(frame.scale).setVisible(false);
      const views = pose.layers.map((layer) => {
        const bend = bends[layer.name];
        const view = bend
          ? this.addRibbon(scene, key, layer, bend, pose.atlasSize, alpha)
          : this.addImage(scene, key, layer);
        group.add(view.object);
        return view;
      });
      this.rigged[name] = { group, views };
      this.container.add(group);
    }

    const group = scene.add.container(0, 0).setVisible(false);
    const images = Array.from({ length: FLAT_LAYERS }, () => scene.add.image(0, 0, BLANK_TEXTURE).setOrigin(0));
    group.add(images);
    this.flat = { group, images };
    this.container.add(group);
  }

  private addImage(scene: Phaser.Scene, key: string, layer: PoseLayer): LayerView {
    return {
      object: scene.add.image(0, 0, key, layerFrame(layer)).setOrigin(0),
      origin: [layer.box[0], layer.box[1]],
    };
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
   * Règle l'opacité de l'ensemble, en proportion de celle donnée à la création (le reflet s'estompe
   * pendant un saut). Les rubans, dessinés par shader, ne suivent pas l'opacité du conteneur.
   */
  setFade(fade: number): void {
    this.container.setAlpha(this.alpha * fade);
    for (const pose of Object.values(this.rigged)) {
      for (const view of pose.views) {
        view.ribbon?.shader.setUniform('uAlpha.value', this.alpha * fade);
      }
    }
  }

  /**
   * Affiche une pose. Son atlas doit être chargé (`HeroAtlases.has`).
   *
   * @param matrices une transformation par calque (voir `poseRig.ts`), ou `null` pour la pose au repos
   * @param ribbonPhase phase de l'ondulation des rubans, en radians
   * @param amplitude 1 pour le mouvement prévu, moins quand les animations sont réduites
   */
  show(name: PoseName, matrices: Affine[] | null, ribbonPhase: number, amplitude: number): void {
    for (const other of PINNED) {
      if (isRigged(other)) {
        this.rigged[other].group.setVisible(other === name);
      }
    }
    this.flat.group.setVisible(!isRigged(name));

    if (isRigged(name)) {
      this.rigged[name].views.forEach((view, index) => {
        place(view.object, matrices?.[index] ?? IDENTITY, view.origin);
        if (view.ribbon) {
          view.ribbon.shader.setUniform('uBend.value.x', view.ribbon.bend.amplitude * amplitude);
          view.ribbon.shader.setUniform('uBend.value.z', ribbonPhase + index);
        }
      });
      return;
    }

    if (!this.atlases.use(name)) {
      this.flat.group.setVisible(false);
      return;
    }
    const frame = poseFrame(name);
    this.flat.group.setPosition(frame.x, frame.y).setScale(frame.scale);
    const key = poseTextureKey(name);
    const layers: PoseLayer[] = POSES[name].layers;
    this.flat.images.forEach((image, index) => {
      const layer = layers[index];
      if (!layer) {
        image.setTexture(BLANK_TEXTURE).setVisible(false);
        return;
      }
      image.setTexture(key, layerFrame(layer)).setVisible(true);
      place(image, matrices?.[index] ?? IDENTITY, [layer.box[0], layer.box[1]]);
    });
  }
}
