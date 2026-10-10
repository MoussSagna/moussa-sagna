// Fichier généré par tools/pack_rig.py à partir de moussa_rig/rig.json. Ne pas modifier à la main.

export interface RigLayer {
  name: string
  /** Indice du parent dans `layers`, -1 pour la racine. */
  parent: number
  /** 'matrix' : hérite de toute la transformation du parent ; 'point' : suit seulement le déplacement de son pivot. */
  follow: 'matrix' | 'point'
  pivot: [number, number]
  /** Rectangle du calque dans la toile (x, y, largeur, hauteur), marge transparente comprise. */
  box: [number, number, number, number]
  /** Coin haut gauche de ce rectangle dans l'atlas. */
  atlas: [number, number]
  breathScale: [number, number]
  /** Angles en degrés, phase en fraction de cycle. */
  rot: number
  sway: number
  lift: number
  phase: number
  /** Ondulation des rubans : amplitude à la pointe (px), axe unitaire racine vers pointe, longueur (px). */
  bend: number
  axis: [number, number]
  length: number
}

/** Le rig du personnage : toile en pixels du maître, calques du fond vers le premier plan. */
export const RIG: { canvas: [number, number]; cycleSeconds: number; atlasSize: [number, number]; layers: RigLayer[] } = {
  canvas: [1024, 1536],
  cycleSeconds: 4,
  atlasSize: [2048, 2048],
  layers: [
    { name: 'rb_long', parent: 9, follow: 'point', pivot: [432, 208], box: [37, 155, 426, 278], atlas: [0, 1324], breathScale: [0, 0], rot: 0, sway: 0.9, lift: 0, phase: 0.38, bend: 7, axis: [-0.911922, 0.410365], length: 400 },
    { name: 'rb_mid', parent: 9, follow: 'point', pivot: [318, 350], box: [8, 276, 362, 383], atlas: [0, 941], breathScale: [0, 0], rot: 0, sway: 0.9, lift: 0, phase: 0.52, bend: 7, axis: [-0.750714, 0.660628], length: 400 },
    { name: 'rb_low', parent: 9, follow: 'point', pivot: [262, 615], box: [37, 535, 257, 342], atlas: [362, 941], breathScale: [0, 0], rot: 0, sway: 1, lift: 0, phase: 0.66, bend: 6, axis: [-0.660628, 0.750714], length: 300 },
    { name: 'rb_bottom', parent: 9, follow: 'point', pivot: [286, 772], box: [124, 707, 204, 338], atlas: [619, 941], breathScale: [0, 0], rot: 0, sway: 1, lift: 0, phase: 0.8, bend: 6, axis: [-0.498284, 0.867014], length: 290 },
    { name: 'rb_hip', parent: 8, follow: 'point', pivot: [356, 866], box: [246, 794, 173, 279], atlas: [1507, 941], breathScale: [0, 0], rot: 0, sway: 0.9, lift: 0, phase: 0.92, bend: 4, axis: [-0.398726, 0.91707], length: 210 },
    { name: 'rb_right', parent: 8, follow: 'point', pivot: [850, 848], box: [811, 808, 168, 302], atlas: [1142, 941], breathScale: [0, 0], rot: 0, sway: 0.8, lift: 0, phase: 0.6, bend: 4, axis: [0.398726, 0.91707], length: 260 },
    { name: 'rb_top', parent: 15, follow: 'point', pivot: [532, 125], box: [354, 46, 223, 180], atlas: [702, 1324], breathScale: [0, 0], rot: 0, sway: 1.2, lift: 0, phase: 0.3, bend: 4, axis: [-0.943858, 0.33035], length: 180 },
    { name: 'rb_knot', parent: 15, follow: 'point', pivot: [530, 165], box: [406, 114, 165, 120], atlas: [1094, 1324], breathScale: [0, 0], rot: 0, sway: 1, lift: 0, phase: 0.42, bend: 2, axis: [-0.970143, 0.242536], length: 95 },
    { name: 'lower', parent: -1, follow: 'matrix', pivot: [560, 1500], box: [132, 580, 886, 941], atlas: [0, 0], breathScale: [0, 0], rot: 0, sway: 0, lift: 0, phase: 0, bend: 0, axis: [1, 0], length: 1 },
    { name: 'torso', parent: 8, follow: 'matrix', pivot: [610, 640], box: [390, 130, 416, 601], atlas: [886, 0], breathScale: [0.005, 0.009], rot: 0, sway: 0, lift: 0, phase: 0, bend: 0, axis: [1, 0], length: 1 },
    { name: 'arm_r', parent: 13, follow: 'point', pivot: [810, 578], box: [757, 546, 197, 292], atlas: [1310, 941], breathScale: [0, 0], rot: -0.25, sway: 0, lift: 0, phase: 0.12, bend: 0, axis: [1, 0], length: 1 },
    { name: 'jacket', parent: 9, follow: 'matrix', pivot: [610, 640], box: [341, 152, 473, 562], atlas: [1302, 0], breathScale: [0.003, 0], rot: 0, sway: 0, lift: 0, phase: 0, bend: 0, axis: [1, 0], length: 1 },
    { name: 'arm_l', parent: 14, follow: 'point', pivot: [330, 560], box: [249, 530, 183, 326], atlas: [823, 941], breathScale: [0, 0], rot: 0.3, sway: 0, lift: 0, phase: 0.12, bend: 0, axis: [1, 0], length: 1 },
    { name: 'sleeve_r', parent: 11, follow: 'matrix', pivot: [735, 300], box: [722, 300, 136, 304], atlas: [1006, 941], breathScale: [0, 0], rot: -0.2, sway: 0, lift: 0, phase: 0.05, bend: 0, axis: [1, 0], length: 1 },
    { name: 'sleeve_l', parent: 11, follow: 'matrix', pivot: [400, 290], box: [201, 208, 247, 443], atlas: [1775, 0], breathScale: [0, 0], rot: 0.25, sway: 0, lift: 0, phase: 0.05, bend: 0, axis: [1, 0], length: 1 },
    { name: 'head', parent: 9, follow: 'point', pivot: [590, 215], box: [525, 101, 169, 163], atlas: [925, 1324], breathScale: [0, 0], rot: 0.45, sway: 0, lift: -0.5, phase: 0.1, bend: 0, axis: [1, 0], length: 1 },
    { name: 'hair', parent: 15, follow: 'matrix', pivot: [620, 120], box: [506, -3, 276, 216], atlas: [426, 1324], breathScale: [0, 0], rot: 0.12, sway: 0, lift: 0, phase: 0.2, bend: 0, axis: [1, 0], length: 1 },
  ],
}
