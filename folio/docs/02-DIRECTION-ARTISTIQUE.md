# Direction artistique — ce qui est propre au portfolio

La direction artistique du projet est dans [`../../docs/DIRECTION_ARTISTIQUE.md`](../../docs/DIRECTION_ARTISTIQUE.md), à la racine du dépôt. Elle fait foi pour la référence visuelle, la palette, la typographie, le mouvement et le personnage. Ce document ne la répète pas : il décrit seulement comment le portfolio l'applique, et où il s'en écarte encore.

## Où vivent les couleurs et les polices

Dans le portfolio, ce sont des variables CSS déclarées en tête de `src/styles/main.css` (et non les jetons Tailwind de `src/index.css` cités à la racine, qui sont ceux du lab). Aucune couleur ne s'écrit en dur dans une page ou un composant.

| Variable | Valeur | Rôle |
|---|---|---|
| `--red` | `#e8262d` | Le rouge principal, celui de la racine (`blood`). Accents, soulignements, liserés, halos. |
| `--red-deep` | `#d4161d` | Aplats rouges qui portent du texte blanc : les boutons pleins. |
| `--red-dark` | `#8e1027` | Ombres de titre et dégradés sombres. |

La scène Phaser a sa propre constante pour ce rouge : `COLOR_RED` dans `src/game/scenes/ArenaScene.ts`. Elle doit suivre `--red`.

### Le rouge des boutons pleins

Du texte blanc posé sur le rouge principal `#e8262d` donne un contraste de 4,42:1, sous le seuil AA de 4,5:1 pour un texte de cette taille. Les boutons pleins utilisent donc `--red-deep`, de même teinte et plus sombre, qui donne 5,34:1.

Au survol ou au focus, les boutons pleins (dont celui des cartes de projet) passent au rouge principal : le contraste y retombe à 4,42:1. C'est un point à corriger.

## Écarts avec la racine, à résorber

Seul le rouge a été aligné. Le reste du site suit encore sa palette et ses polices d'origine :

| Sujet | Racine | Portfolio aujourd'hui |
|---|---|---|
| Fond de page | `ink` `#08060d` | `--night` `#070b12` |
| Texte principal | `line` `#f4efe9` | `--white` `#f2f4f7` |
| Texte secondaire | `muted` `#b8afc4` | `--text-soft` `#c7ced9`, `--grey` `#8f9aaa` |
| Violet (néons, adversaire) | `violet` `#8b6bff` | `--violet` `#8b35f5`, `--violet-soft` `#b98bff` |
| Focus clavier | `sakura` `#ff8fc0` | `--cyan` `#29c8f2` |
| Texte courant et étiquettes | Barlow Semi Condensed | Police système pour le texte, Chakra Petch pour les étiquettes |
| Titres | Anton, en italique et en capitales | Anton, en capitales, sans italique |
| Rouge clair en texte | — | `#ff6b80`, écrit en dur à cinq endroits |
| Vue du personnage | Toujours de trois quarts à profil, tourné vers la droite | De face sur l'accueil (`stance.webp`) ; de trois quarts dans l'arène |
| Baskets | Sans logo de marque | Logo visible sur la pose de l'accueil |

`--red-dark` et le rouge clair `#ff6b80` gardent la teinte de l'ancien rouge principal, un peu plus rosée que `#e8262d`.

## Règles d'interface du portfolio

- **Habillage façon jeu de combat** : cadres fins, lignes techniques, panneaux HUD, bandeau de jauges en bas de l'accueil. Les jauges sont décoratives et ne mesurent rien.
- **Boutons et cartes inclinés** par `transform: skew`, pas découpés par `clip-path`, pour que le contour de focus clavier reste visible.
- **Lisibilité d'abord** : le décor est dense, la zone centrale reste lisible. Éviter d'employer plusieurs couleurs vives à pleine intensité en même temps.

## Le décor dans les pages

Un seul décor existe, `stage.webp`. En dehors de l'arène il sert de fond fixe à l'accueil, à l'intro, au contact, au parcours, à la sélection des projets et à la page de secours : toujours recadré (`object-fit: cover`), jamais étiré, sous un voile sombre plus ou moins dense selon la quantité de texte. Dans l'arène, le même décor est animé (voir `03-ARCHITECTURE-TECHNIQUE.md`).

## Les combattants dans les pages

- **Couleurs** : rouge pour Moussa (P1), violet pour l'adversaire (CPU). Chaque visuel porte un liseré et un halo à la couleur de son combattant.
- **Moussa** : en pied sur l'accueil, en portrait de profil dans l'intro et la page À propos, avec quatre expressions sur À propos. Ces visuels sont découpés dans une planche gardée hors du dépôt : voir `07-PERSONNAGE-MOUSSA.md`.
- **L'adversaire** n'a pas encore de visuel : l'accueil et l'intro affichent un cadre violet « visuel à fournir », en attendant un personnage original. Un combattant placé à droite de l'écran est affiché en miroir pour faire face à Moussa.

Rien n'a été dessiné ni généré pour les pages : tout ce qui manque s'affiche comme manquant.
