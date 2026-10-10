/** Caméra commune à tous les plans : décalage de parallaxe (en fraction d'écran) et zoom. */
export interface Camera {
  ox: number
  oy: number
  zoom: number
}

export interface StageOptions {
  rain: boolean
  petals: boolean
  /** Réduit les mouvements : plus d'éclairs ni de parasites, caméra fixe, moins de particules. */
  calm: boolean
}

export interface FrameInfo {
  /** Secondes depuis le démarrage. */
  time: number
  /** Durée de l'image précédente, en secondes. */
  delta: number
  width: number
  height: number
}
