/** Caméra commune à tous les plans : décalage de parallaxe (en fraction d'écran) et zoom. */
export interface Camera {
  ox: number
  oy: number
  zoom: number
  /** Travelling horizontal, en fraction de la largeur de l'image : tout le décor glisse d'un bloc (sans parallaxe). */
  pan?: number
}

export interface StageOptions {
  rain: boolean
  petals: boolean
  /** Réduit les mouvements : plus d'éclairs ni de parasites, caméra fixe, moins de particules. */
  calm: boolean
  /** Qui fait face au personnage : le mannequin d'entraînement ou l'adversaire. Le mannequin par défaut. */
  opponent?: 'dummy' | 'rival'
  /** Vrai tant que l'adversaire doit parer, pour tester les coups parés. */
  rivalBlocks?: boolean
  /** Faux pour garder l'adversaire immobile ; sinon il marche pour garder ses distances. */
  rivalMoves?: boolean
  /** Vrai quand le joueur contrôle l'adversaire avec les flèches. */
  rivalControl?: boolean
}

export interface FrameInfo {
  /** Secondes depuis le démarrage. */
  time: number
  /** Durée de l'image précédente, en secondes. */
  delta: number
  width: number
  height: number
}
