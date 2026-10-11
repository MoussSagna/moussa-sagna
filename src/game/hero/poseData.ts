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
  step: {
    file: 'hero/step.webp',
    atlasSize: [2048, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [542, 1470] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [35, 41, 939, 1439], atlas: [0, 0] },
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
  walkPass: {
    file: 'hero/walkPass.webp',
    atlasSize: [2048, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [684, 1480] as Point,
    joints: {
      hip_near: [565, 722] as Point,
      knee_near: [575, 1010] as Point,
      ankle_near: [585, 1310] as Point,
      hip_far: [545, 722] as Point,
      knee_far: [681, 1008] as Point,
      ankle_far: [440, 1105] as Point,
      shoulder_near: [490, 300] as Point,
      shoulder_far: [660, 360] as Point,
      neck: [595, 240] as Point,
      ribbon: [505, 135] as Point,
      ribbon_low: [318, 640] as Point,
    },
    layers: [
      { name: 'ribbons', parent: 12, pivot: [505, 135], box: [29, 100, 485, 599], atlas: [1004, 0] },
      { name: 'ribbon_low', parent: 11, pivot: [318, 640], box: [102, 601, 227, 224], atlas: [986, 1585] },
      { name: 'arm_far', parent: 11, pivot: [660, 360], box: [682, 442, 171, 398], atlas: [829, 1094] },
      { name: 'pelvis', parent: 11, pivot: [565, 722], box: [399, 679, 283, 263], atlas: [1502, 1094] },
      { name: 'foot_far', parent: 5, pivot: [440, 1105], box: [334, 987, 195, 352], atlas: [1307, 1094] },
      { name: 'shin_far', parent: 6, pivot: [681, 1008], box: [363, 931, 396, 252], atlas: [0, 1585] },
      { name: 'thigh_far', parent: 11, pivot: [545, 722], box: [458, 653, 311, 443], atlas: [518, 1094] },
      { name: 'foot_near', parent: 8, pivot: [585, 1310], box: [521, 1247, 326, 242], atlas: [660, 1585] },
      { name: 'shin_near', parent: 9, pivot: [575, 1010], box: [402, 932, 307, 395], atlas: [1000, 1094] },
      { name: 'thigh_near', parent: 11, pivot: [565, 722], box: [457, 582, 331, 527], atlas: [1489, 0] },
      { name: 'hip', parent: 11, pivot: [565, 722], box: [191, 582, 518, 491], atlas: [0, 1094] },
      { name: 'torso', parent: -1, pivot: [565, 722], box: [43, 162, 735, 1094], atlas: [0, 0] },
      { name: 'head', parent: 11, pivot: [595, 240], box: [490, 20, 264, 250], atlas: [396, 1585] },
      { name: 'arm_near', parent: 11, pivot: [490, 300], box: [275, 210, 269, 641], atlas: [735, 0] },
    ] as PoseLayer[],
  },
  walkReach: {
    file: 'hero/walkReach.webp',
    atlasSize: [2048, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [513, 1479] as Point,
    joints: {
      hip_near: [565, 735] as Point,
      knee_near: [520, 1035] as Point,
      ankle_near: [470, 1310] as Point,
      hip_far: [545, 735] as Point,
      knee_far: [853, 843] as Point,
      ankle_far: [785, 1105] as Point,
      shoulder_near: [495, 305] as Point,
      shoulder_far: [665, 365] as Point,
      neck: [605, 245] as Point,
      ribbon: [515, 140] as Point,
      ribbon_low: [318, 640] as Point,
    },
    layers: [
      { name: 'ribbons', parent: 12, pivot: [515, 140], box: [27, 109, 497, 738], atlas: [710, 0] },
      { name: 'ribbon_low', parent: 11, pivot: [318, 640], box: [107, 592, 221, 250], atlas: [1806, 958] },
      { name: 'arm_far', parent: 11, pivot: [665, 365], box: [682, 447, 170, 374], atlas: [288, 958] },
      { name: 'pelvis', parent: 11, pivot: [565, 735], box: [404, 684, 283, 263], atlas: [1523, 958] },
      { name: 'foot_far', parent: 5, pivot: [785, 1105], box: [674, 1042, 308, 247], atlas: [265, 1425] },
      { name: 'shin_far', parent: 6, pivot: [853, 843], box: [632, 827, 267, 270], atlas: [1256, 958] },
      { name: 'thigh_far', parent: 11, pivot: [545, 735], box: [452, 652, 495, 344], atlas: [458, 958] },
      { name: 'foot_near', parent: 8, pivot: [470, 1310], box: [350, 1252, 328, 236], atlas: [573, 1425] },
      { name: 'shin_near', parent: 9, pivot: [520, 1035], box: [336, 967, 303, 337], atlas: [953, 958] },
      { name: 'thigh_near', parent: 11, pivot: [565, 735], box: [421, 582, 288, 467], atlas: [0, 958] },
      { name: 'hip', parent: 11, pivot: [565, 735], box: [210, 582, 499, 567], atlas: [1488, 0] },
      { name: 'torso', parent: -1, pivot: [565, 735], box: [27, 162, 710, 958], atlas: [0, 0] },
      { name: 'head', parent: 11, pivot: [605, 245], box: [502, 24, 265, 249], atlas: [0, 1425] },
      { name: 'arm_near', parent: 11, pivot: [495, 305], box: [268, 218, 281, 673], atlas: [1207, 0] },
    ] as PoseLayer[],
  },
}
