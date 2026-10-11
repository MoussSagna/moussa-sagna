// Fichier généré par tools/prepare_poses.py à partir des illustrations de art/. Ne pas modifier à la main.

export type Point = [number, number]

export interface PoseLayer {
  name: string
  /** Indice du parent dans `layers`, -1 pour la racine. */
  parent: number
  pivot: Point
  /** Rectangle du calque dans la toile (x, y, largeur, hauteur), marge transparente comprise. */
  box: [number, number, number, number]
  /** Coin haut gauche de ce rectangle dans l'atlas. */
  atlas: Point
}

/** Toile commune à toutes les poses, en pixels des illustrations. */
export const CANVAS: Point = [1024, 1536]

/** Les poses du personnage, chacune découpée en calques du fond vers le premier plan. */
export const POSES = {
  guard: {
    file: 'hero/guard.webp',
    atlasSize: [2048, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [518, 1487] as Point,
    joints: {
      waist: [560, 705] as Point,
      neck: [600, 300] as Point,
      ribbon: [510, 190] as Point,
      ribbon_low: [300, 650] as Point,
    },
    layers: [
      { name: 'ribbons', parent: 3, pivot: [510, 190], box: [22, 130, 507, 685], atlas: [965, 0] },
      { name: 'ribbon_low', parent: 3, pivot: [300, 650], box: [121, 588, 163, 321], atlas: [872, 841] },
      { name: 'lower', parent: -1, pivot: [560, 705], box: [36, 656, 965, 841], atlas: [0, 0] },
      { name: 'upper', parent: 2, pivot: [560, 705], box: [23, 56, 872, 682], atlas: [0, 841] },
      { name: 'head', parent: 3, pivot: [600, 300], box: [497, 56, 284, 287], atlas: [1035, 841] },
    ] as PoseLayer[],
  },
  walk: {
    file: 'hero/walk.webp',
    atlasSize: [2048, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [582, 1476] as Point,
    joints: {
      hip_near: [560, 745] as Point,
      knee_near: [690, 1040] as Point,
      ankle_near: [760, 1320] as Point,
      hip_far: [540, 745] as Point,
      knee_far: [350, 1060] as Point,
      ankle_far: [215, 1265] as Point,
      shoulder_near: [410, 340] as Point,
      shoulder_far: [650, 400] as Point,
      neck: [590, 280] as Point,
      ribbon: [500, 185] as Point,
      ribbon_low: [222, 595] as Point,
    },
    layers: [
      { name: 'ribbons', parent: 12, pivot: [500, 185], box: [24, 136, 488, 827], atlas: [696, 0] },
      { name: 'ribbon_low', parent: 11, pivot: [222, 595], box: [72, 537, 177, 172], atlas: [886, 1702] },
      { name: 'arm_far', parent: 11, pivot: [650, 400], box: [682, 432, 183, 419], atlas: [831, 1150] },
      { name: 'pelvis', parent: 11, pivot: [560, 745], box: [379, 689, 283, 263], atlas: [0, 1702] },
      { name: 'foot_far', parent: 5, pivot: [215, 1265], box: [56, 1187, 285, 275], atlas: [1664, 1150] },
      { name: 'shin_far', parent: 6, pivot: [350, 1060], box: [160, 956, 329, 308], atlas: [1335, 1150] },
      { name: 'thigh_far', parent: 11, pivot: [540, 745], box: [169, 652, 475, 552], atlas: [0, 1150] },
      { name: 'foot_near', parent: 8, pivot: [760, 1320], box: [667, 1253, 337, 232], atlas: [549, 1702] },
      { name: 'shin_near', parent: 9, pivot: [690, 1040], box: [537, 997, 321, 337], atlas: [1014, 1150] },
      { name: 'thigh_near', parent: 11, pivot: [560, 745], box: [447, 592, 356, 500], atlas: [475, 1150] },
      { name: 'hip', parent: 11, pivot: [560, 745], box: [157, 592, 552, 582], atlas: [1491, 0] },
      { name: 'torso', parent: -1, pivot: [560, 745], box: [24, 186, 696, 1150], atlas: [0, 0] },
      { name: 'head', parent: 11, pivot: [590, 280], box: [488, 50, 266, 260], atlas: [283, 1702] },
      { name: 'arm_near', parent: 11, pivot: [410, 340], box: [192, 277, 307, 617], atlas: [1184, 0] },
    ] as PoseLayer[],
  },
  step: {
    file: 'hero/step.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [542, 1470] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [35, 41, 939, 1439], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  dashForward: {
    file: 'hero/dashForward.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [560, 1356] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [3, 301, 1012, 1064], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  dashBack: {
    file: 'hero/dashBack.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [360, 1346] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [9, 169, 1023, 1186], atlas: [0, 0] },
    ] as PoseLayer[],
  },
}
