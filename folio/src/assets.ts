/**
 * Chemins des assets servis depuis `public/`.
 * Chaque chemin déclaré ici doit correspondre à un fichier réellement présent.
 */
const base = import.meta.env.BASE_URL;

/** Décor signature : public/assets/backgrounds/stage.webp (1672 × 941). */
export const STAGE_BACKGROUND_URL = `${base}assets/backgrounds/stage.webp`;

/*
 * Les images du jeu (décor animé, personnages, effets, cinématique, écran de chargement) ne sont pas ici : elles
 * sont dans `../game/public/assets/` et se chargent par `asset()` (`@game/gl`).
 */
