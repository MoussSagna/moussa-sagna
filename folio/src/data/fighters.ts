export type FighterId = 'moussa' | 'challenger';

/** Image servie depuis `public/`. Le chemin s'écrit sans slash initial. */
export interface FighterArt {
  src: string;
  /** Dimensions réelles du fichier, en pixels : elles réservent la place de l'image avant son chargement. */
  width: number;
  height: number;
}

export interface Fighter {
  id: FighterId;
  name: string;
  /** Lettre affichée dans l'emplacement tant que le portrait manque. */
  initial: string;
  /** Étiquette de joueur affichée dans le HUD. */
  slot: string;
  tagline: string;
  /** Gros plan affiché dans un cadre (intro, à propos). `null` : un emplacement stylisé est affiché. */
  portrait: FighterArt | null;
  /** Personnage en pied, détouré sur fond transparent (accueil). `null` : le cadre du portrait est utilisé. */
  stance: FighterArt | null;
  /** Vignettes d'expressions, dans l'ordre de la planche de référence. */
  expressions: FighterArt[];
  /**
   * Affiche les visuels en miroir. Les illustrations regardent vers la droite ; un combattant placé à droite
   * de l'écran est retourné pour faire face à son adversaire.
   */
  mirrored: boolean;
}

// Les visuels de Moussa sont extraits de `references/planche-moussa-transparente.png` (dossier local, hors du dépôt).
// Zones découpées et limites connues : voir `docs/07-PERSONNAGE-MOUSSA.md`.
const MOUSSA_ASSETS = 'assets/fighters/moussa';
const CHALLENGER_ASSETS = 'assets/fighters/challenger';

export const FIGHTERS: Record<FighterId, Fighter> = {
  moussa: {
    id: 'moussa',
    name: 'Moussa',
    initial: 'M',
    slot: 'P1',
    tagline: 'Creative Developer',
    portrait: { src: `${MOUSSA_ASSETS}/portrait.webp`, width: 500, height: 520 },
    stance: { src: `${MOUSSA_ASSETS}/stance.webp`, width: 355, height: 663 },
    expressions: [
      { src: `${MOUSSA_ASSETS}/expression-1.webp`, width: 99, height: 211 },
      { src: `${MOUSSA_ASSETS}/expression-2.webp`, width: 96, height: 211 },
      { src: `${MOUSSA_ASSETS}/expression-3.webp`, width: 95, height: 211 },
      { src: `${MOUSSA_ASSETS}/expression-4.webp`, width: 87, height: 211 },
    ],
    mirrored: false,
  },
  // Shigaraki, l'adversaire original du lab. Ses visuels sont générés à partir de ceux du lab : le portrait est découpé
  // dans son gros plan de plan de coupe (`../lab/public/assets/cinematic/cutin-rival.webp`), le personnage en pied
  // est celui de l'écran de chargement (`../lab/public/assets/loading/rival.webp`), réduit à la hauteur de Moussa.
  challenger: {
    id: 'challenger',
    name: 'Shigaraki',
    initial: 'S',
    slot: 'CPU',
    tagline: 'Le boss final',
    portrait: { src: `${CHALLENGER_ASSETS}/portrait.webp`, width: 500, height: 520 },
    stance: { src: `${CHALLENGER_ASSETS}/stance.webp`, width: 445, height: 663 },
    expressions: [],
    mirrored: true,
  },
};

export function fighterArtUrl(art: FighterArt): string {
  return `${import.meta.env.BASE_URL}${art.src}`;
}
