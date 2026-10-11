/** Caméra du décor : décalage de parallaxe (en fraction d'écran) et zoom. */
export interface StageCamera {
  ox: number;
  oy: number;
  zoom: number;
}

/** Durée du travelling d'ouverture, en millisecondes. */
export const INTRO_MS = 3600;

/**
 * Calcule la caméra : travelling d'ouverture (zoom arrière), respiration lente et position du pointeur.
 * Avec `calm` (« réduire les animations »), seul le pointeur reste.
 *
 * @param time secondes écoulées depuis le démarrage de la scène
 * @param introMs millisecondes écoulées depuis le début du travelling
 * @param pointer position lissée du pointeur, de -1 à 1 sur chaque axe
 */
export function computeCamera(
  time: number,
  introMs: number,
  pointer: { x: number; y: number },
  calm: boolean,
): StageCamera {
  const sway = calm ? 0 : 1;
  const progress = Math.min(1, Math.max(0, introMs / INTRO_MS));
  const settle = 1 - (1 - progress) ** 3;
  return {
    ox: pointer.x * 0.02 + Math.sin(time * 0.21) * 0.007 * sway + (1 - settle) * 0.045 * sway,
    oy: pointer.y * 0.008 + Math.cos(time * 0.17) * 0.003 * sway,
    zoom: 1.045 + (1 - settle) * 0.13 * sway + Math.sin(time * 0.13) * 0.006 * sway,
  };
}
