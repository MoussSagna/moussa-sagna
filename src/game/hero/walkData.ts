// Fichier généré par tools/prepare_walk.py à partir de art/hero-walk-source.png. Ne pas modifier à la main.

export interface WalkLayer {
  name: string
  /** Indice du parent dans `layers`, -1 pour la racine. */
  parent: number
  pivot: [number, number]
  /** Rectangle du calque dans la toile (x, y, largeur, hauteur), marge transparente comprise. */
  box: [number, number, number, number]
  /** Coin haut gauche de ce rectangle dans l'atlas. */
  atlas: [number, number]
}

/** Le personnage de profil, découpé pour la marche : calques du fond vers le premier plan. */
export const WALK_RIG = {
  canvas: [1024, 1536] as [number, number],
  atlasSize: [2048, 2048] as [number, number],
  /** Bas de la semelle de chaque chaussure et sommet du crâne, en pixels de la toile. */
  soleNear: 1473,
  soleFar: 1458,
  headTop: 94,
  joints: {
    hip_near: [610, 800] as [number, number],
    knee_near: [735, 1050] as [number, number],
    ankle_near: [800, 1310] as [number, number],
    hip_far: [590, 800] as [number, number],
    knee_far: [410, 1085] as [number, number],
    ankle_far: [215, 1270] as [number, number],
    shoulder_near: [480, 390] as [number, number],
    shoulder_far: [670, 450] as [number, number],
    neck: [650, 270] as [number, number],
    ribbon: [548, 200] as [number, number],
  },
  layers: [
    { name: 'ribbons', parent: 11, pivot: [548, 200], box: [15, 155, 546, 864], atlas: [605, 0] },
    { name: 'arm_far', parent: 10, pivot: [670, 450], box: [698, 514, 261, 375], atlas: [812, 1096] },
    { name: 'pelvis', parent: 10, pivot: [610, 800], box: [439, 744, 293, 273], atlas: [0, 1553] },
    { name: 'foot_far', parent: 4, pivot: [215, 1270], box: [32, 1169, 281, 298], atlas: [1731, 1096] },
    { name: 'shin_far', parent: 5, pivot: [410, 1085], box: [158, 967, 381, 309], atlas: [1073, 1096] },
    { name: 'thigh_far', parent: 10, pivot: [590, 800], box: [314, 712, 375, 442], atlas: [437, 1096] },
    { name: 'foot_near', parent: 7, pivot: [800, 1310], box: [682, 1243, 335, 240], atlas: [293, 1553] },
    { name: 'shin_near', parent: 8, pivot: [735, 1050], box: [624, 1007, 277, 302], atlas: [1454, 1096] },
    { name: 'thigh_near', parent: 10, pivot: [610, 800], box: [422, 652, 441, 469], atlas: [1477, 0] },
    { name: 'hip', parent: 10, pivot: [610, 800], box: [317, 652, 437, 457], atlas: [0, 1096] },
    { name: 'torso', parent: -1, pivot: [610, 800], box: [157, 214, 605, 1096], atlas: [0, 0] },
    { name: 'head', parent: 10, pivot: [650, 270], box: [532, 86, 277, 223], atlas: [628, 1553] },
    { name: 'arm_near', parent: 10, pivot: [480, 390], box: [228, 309, 326, 601], atlas: [1151, 0] },
  ] as WalkLayer[],
}
