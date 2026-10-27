/**
 * Chemins des assets servis depuis `public/`.
 * Chaque chemin déclaré ici doit correspondre à un fichier réellement présent.
 */
const base = import.meta.env.BASE_URL;

/** Décor signature : public/assets/backgrounds/stage.webp (1672 × 941). */
export const STAGE_BACKGROUND_URL = `${base}assets/backgrounds/stage.webp`;

/**
 * Carte du décor : public/assets/backgrounds/depth.png (836 × 470).
 * Chaque canal porte une information (rouge = profondeur, vert = ciel, bleu = écrans) :
 * ne pas la recompresser ni la redimensionner.
 */
export const STAGE_DEPTH_URL = `${base}assets/backgrounds/depth.png`;

/** Atlas des poses de Moussa : public/assets/fighters/moussa/poses/ (2048 × 2048, WebP sans perte). */
/**
 * Plans de la cinématique d'entrée : public/assets/cinematic/ (environ 1670 × 941). Repris tels quels de
 * `../lab/public/assets/cinematic/`, où `tools/prepare_cinematic.py` les prépare (logo des baskets effacé).
 */
export const cinematicShotUrl = (shot: string): string => `${base}assets/cinematic/${shot}.webp`;

export const heroPoseUrl = (pose: string): string => `${base}assets/fighters/moussa/poses/${pose}.webp`;

/**
 * Poses de Shigaraki : public/assets/fighters/challenger/poses/ (1024 × 1536, WebP). Recadrées et compressées à
 * partir des images de `../lab/public/assets/rival/`, préparées par `tools/prepare_rival.py`.
 */
export const rivalPoseUrl = (pose: string): string => `${base}assets/fighters/challenger/poses/${pose}.webp`;
