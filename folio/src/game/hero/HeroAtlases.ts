import type Phaser from 'phaser';
import { heroPoseUrl } from '../../assets';
import type { PoseName } from './heroState';
import { POSES } from './poseData';
import type { PoseLayer } from './poseData';

/** Clé de texture Phaser de l'atlas d'une pose. */
export const poseTextureKey = (pose: PoseName): string => `hero-${pose}`;

/** Nom de l'image d'un calque dans l'atlas de sa pose. */
export const layerFrame = (layer: PoseLayer): string => `layer-${layer.name}`;

/**
 * Poses dont l'atlas reste toujours en mémoire vidéo : leurs rubans sont dessinés par des shaders qui
 * gardent une référence à la texture.
 */
export const PINNED: PoseName[] = ['guard', 'walk'];

/**
 * Nombre d'autres atlas gardés en mémoire vidéo. Un atlas y pèse 10 à 20 Mo une fois décompressé : les
 * garder tous (plus de 250 Mo) fait perdre le contexte WebGL sur les appareils modestes. Six suffisent
 * pour un enchaînement complet de coups de poing.
 */
const MAX_UNPINNED = 6;

/**
 * Les atlas du personnage. Les images sont téléchargées et gardées ici ; elles ne sont envoyées à la
 * carte graphique (dans le gestionnaire de textures de Phaser) qu'au moment de servir, et les moins
 * récemment utilisées en sont retirées. Repris de `HeroLayer.atlas` de `lab/`.
 */
export class HeroAtlases {
  private textures: Phaser.Textures.TextureManager;
  private images = new Map<PoseName, HTMLImageElement>();
  /** Atlas non épinglés présents en mémoire vidéo, du moins récemment utilisé au plus récent. */
  private recent: PoseName[] = [];
  private closed = false;

  constructor(textures: Phaser.Textures.TextureManager) {
    this.textures = textures;
  }

  /** Télécharge et décode les atlas de ces poses. Résout `false` si l'un d'eux est introuvable. */
  async load(names: PoseName[]): Promise<boolean> {
    const loaded = await Promise.all(names.map((name) => this.loadOne(name)));
    return loaded.every(Boolean);
  }

  private loadOne(name: PoseName): Promise<boolean> {
    if (this.images.has(name)) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        // décoder tout de suite évite de le faire au premier affichage de la pose
        image
          .decode()
          .catch(() => undefined)
          .then(() => {
            this.images.set(name, image);
            resolve(true);
          });
      };
      image.onerror = () => {
        console.error(`[HeroAtlases] Atlas introuvable pour la pose "${name}" (${image.src}).`);
        resolve(false);
      };
      image.src = heroPoseUrl(name);
    });
  }

  /** Vrai si les images de toutes ces poses sont arrivées : l'action qui les utilise peut être lancée. */
  has(...names: PoseName[]): boolean {
    return names.every((name) => this.images.has(name));
  }

  /**
   * Rend la texture d'une pose disponible dans Phaser, en l'envoyant à la carte graphique si besoin.
   * À appeler avant d'afficher la pose. Renvoie `false` si son image n'est pas encore chargée.
   */
  use(name: PoseName): boolean {
    if (this.closed) {
      return false;
    }
    const key = poseTextureKey(name);
    if (!this.textures.exists(key)) {
      const image = this.images.get(name);
      if (!image) {
        return false;
      }
      const texture = this.textures.addImage(key, image);
      if (!texture) {
        return false;
      }
      for (const layer of POSES[name].layers) {
        const [, , width, height] = layer.box;
        texture.add(layerFrame(layer), 0, layer.atlas[0], layer.atlas[1], width, height);
      }
    }
    if (PINNED.includes(name)) {
      return true;
    }
    this.recent = this.recent.filter((other) => other !== name);
    this.recent.push(name);
    while (this.recent.length > MAX_UNPINNED) {
      const stale = this.recent.shift();
      if (stale) {
        this.textures.remove(poseTextureKey(stale));
      }
    }
    return true;
  }

  /** À appeler quand la scène s'arrête : plus aucune texture n'est créée ensuite. */
  close(): void {
    this.closed = true;
  }
}
