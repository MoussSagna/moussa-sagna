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
      { name: 'ribbons', parent: 3, pivot: [510, 190], box: [22, 99, 507, 716], atlas: [965, 0] },
      { name: 'ribbon_low', parent: 3, pivot: [300, 650], box: [120, 588, 164, 321], atlas: [872, 841] },
      { name: 'lower', parent: -1, pivot: [560, 705], box: [36, 656, 965, 841], atlas: [0, 0] },
      { name: 'upper', parent: 2, pivot: [560, 705], box: [23, 56, 872, 682], atlas: [0, 841] },
      { name: 'head', parent: 3, pivot: [600, 300], box: [497, 56, 285, 287], atlas: [1036, 841] },
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
      { name: 'ribbons', parent: 12, pivot: [500, 185], box: [23, 136, 489, 827], atlas: [609, 0] },
      { name: 'ribbon_low', parent: 11, pivot: [222, 595], box: [72, 537, 177, 172], atlas: [886, 1702] },
      { name: 'arm_far', parent: 11, pivot: [650, 400], box: [682, 432, 183, 419], atlas: [831, 1150] },
      { name: 'pelvis', parent: 11, pivot: [560, 745], box: [379, 689, 283, 263], atlas: [0, 1702] },
      { name: 'foot_far', parent: 5, pivot: [215, 1265], box: [56, 1187, 285, 276], atlas: [1664, 1150] },
      { name: 'shin_far', parent: 6, pivot: [350, 1060], box: [160, 956, 329, 308], atlas: [1335, 1150] },
      { name: 'thigh_far', parent: 11, pivot: [540, 745], box: [169, 652, 475, 552], atlas: [0, 1150] },
      { name: 'foot_near', parent: 8, pivot: [760, 1320], box: [667, 1253, 337, 233], atlas: [549, 1702] },
      { name: 'shin_near', parent: 9, pivot: [690, 1040], box: [537, 997, 321, 337], atlas: [1014, 1150] },
      { name: 'thigh_near', parent: 11, pivot: [560, 745], box: [447, 592, 356, 500], atlas: [475, 1150] },
      { name: 'hip', parent: 11, pivot: [560, 745], box: [157, 592, 552, 582], atlas: [1406, 0] },
      { name: 'torso', parent: -1, pivot: [560, 745], box: [111, 186, 609, 1150], atlas: [0, 0] },
      { name: 'head', parent: 11, pivot: [590, 280], box: [488, 49, 266, 261], atlas: [283, 1702] },
      { name: 'arm_near', parent: 11, pivot: [410, 340], box: [191, 277, 308, 617], atlas: [1098, 0] },
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
      { name: 'body', parent: -1, pivot: [512, 768], box: [35, 41, 940, 1439], atlas: [0, 0] },
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
      { name: 'body', parent: -1, pivot: [512, 768], box: [2, 301, 1013, 1064], atlas: [0, 0] },
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
  crouchStep: {
    file: 'hero/crouchStep.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [524, 1435] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [33, 192, 971, 1252], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  crouch: {
    file: 'hero/crouch.webp',
    atlasSize: [1024, 1024] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [548, 1416] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [1, 440, 994, 986], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  blockStep: {
    file: 'hero/blockStep.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [518, 1455] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [24, 89, 978, 1376], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  block: {
    file: 'hero/block.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [519, 1456] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [4, 51, 1002, 1414], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  crouchBlock: {
    file: 'hero/crouchBlock.webp',
    atlasSize: [1024, 1024] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [553, 1389] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [4, 425, 999, 974], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  jumpStart: {
    file: 'hero/jumpStart.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [509, 1381] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [22, 310, 958, 1080], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  jumpRise: {
    file: 'hero/jumpRise.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [520, 1474] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [31, 37, 937, 1446], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  jumpPeak: {
    file: 'hero/jumpPeak.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [520, 1355] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [4, 85, 997, 1279], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  jumpLand: {
    file: 'hero/jumpLand.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [530, 1418] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [3, 54, 982, 1373], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  punchStart: {
    file: 'hero/punchStart.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [483, 1418] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [-8, 58, 1006, 1369], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  punchHit: {
    file: 'hero/punchHit.webp',
    atlasSize: [2048, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [475, 1414] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [-8, 99, 1032, 1324], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  punchMidHit: {
    file: 'hero/punchMidHit.webp',
    atlasSize: [2048, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [518, 1433] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [-3, 109, 1035, 1333], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  punchChain1: {
    file: 'hero/punchChain1.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [495, 1418] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [1, 94, 1005, 1333], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  punchChain2: {
    file: 'hero/punchChain2.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [500, 1430] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [1, 100, 995, 1340], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  punchHeavyStart: {
    file: 'hero/punchHeavyStart.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [518, 1438] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [6, 146, 1012, 1301], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  punchHeavyHit: {
    file: 'hero/punchHeavyHit.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [526, 1463] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [10, 0, 1014, 1473], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  punchHeavyRecover: {
    file: 'hero/punchHeavyRecover.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [518, 1439] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [8, 112, 1005, 1336], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  specialCharge: {
    file: 'hero/specialCharge.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [526, 1410] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [3, 118, 1013, 1301], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  specialThrow: {
    file: 'hero/specialThrow.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [534, 1345] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [10, 220, 1004, 1134], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  specialRecover: {
    file: 'hero/specialRecover.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [518, 1425] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [8, 125, 1002, 1310], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  specialIn1: {
    file: 'hero/specialIn1.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [524, 1407] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [0, 128, 1012, 1288], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  specialIn2: {
    file: 'hero/specialIn2.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [524, 1401] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [1, 114, 1017, 1297], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  specialIn3: {
    file: 'hero/specialIn3.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [524, 1407] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [2, 79, 1022, 1338], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  hurt: {
    file: 'hero/hurt.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [524, 1407] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [3, 57, 1012, 1359], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  hurtRecover: {
    file: 'hero/hurtRecover.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [524, 1407] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [2, 58, 1010, 1359], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  groundCharge: {
    file: 'hero/groundCharge.webp',
    atlasSize: [1024, 1024] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [515, 1293] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [-8, 444, 1008, 859], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  groundRise: {
    file: 'hero/groundRise.webp',
    atlasSize: [1024, 1024] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [509, 1244] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [26, 370, 969, 884], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  groundPalm: {
    file: 'hero/groundPalm.webp',
    atlasSize: [1024, 1024] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [496, 1224] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [16, 423, 1001, 811], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  exitLean: {
    file: 'hero/exitLean.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [517, 1475] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [38, 184, 949, 1301], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  exitCrouch: {
    file: 'hero/exitCrouch.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [541, 1477] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [29, 31, 976, 1455], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  exitGround: {
    file: 'hero/exitGround.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [496, 1444] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [17, 14, 987, 1440], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  exitSpring: {
    file: 'hero/exitSpring.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [500, 1462] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [16, 21, 987, 1451], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  kickStart: {
    file: 'hero/kickStart.webp',
    atlasSize: [1024, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [465, 1445] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [30, 66, 951, 1388], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  kickHit: {
    file: 'hero/kickHit.webp',
    atlasSize: [2048, 2048] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [410, 1438] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'body', parent: -1, pivot: [512, 768], box: [-4, 192, 1033, 1255], atlas: [0, 0] },
    ] as PoseLayer[],
  },
  punchMidRecover: {
    file: 'hero/punchMidRecover.webp',
    atlasSize: [2048, 1024] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [518, 1487] as Point,
    joints: {
      center: [512, 768] as Point,
    },
    layers: [
      { name: 'ribbon_low', parent: -1, pivot: [512, 768], box: [120, 588, 164, 321], atlas: [1823, 0] },
      { name: 'lower', parent: -1, pivot: [512, 768], box: [36, 656, 965, 841], atlas: [0, 0] },
      { name: 'upper', parent: -1, pivot: [512, 768], box: [2, 109, 858, 649], atlas: [965, 0] },
    ] as PoseLayer[],
  },
}
