# Architecture technique cible

> Cible d'origine (sprint 1). Phaser y est prévu pour l'arène ; il a depuis été remplacé par le jeu de `../game/`. Voir « Architecture réelle » plus bas, qui fait foi.

## Stack

- Vite
- TypeScript en mode strict
- Phaser 3 pour le rendu et la simulation de jeu
- WebGL comme moteur de rendu préféré, avec un fallback Canvas uniquement si nécessaire et documenté
- React pour l'interface de portfolio autour du jeu, lorsque cette interface sera introduite

## Principe de séparation

- **Phaser** : canvas, scène de jeu, caméra, monde, éléments du décor et futurs systèmes de gameplay.
- **React** : navigation du portfolio, pages projets, contenu textuel et composants d'interface.
- Ne pas utiliser React pour simuler la boucle de jeu ou déplacer des sprites à chaque frame.
- Éviter de mélanger les responsabilités entre interface HTML et scène Phaser.

## Résolution de référence

- Résolution logique de départ : `1280 × 720`.
- Le canvas doit s'adapter à la taille disponible sans déformer le ratio de la scène.
- Centrer la scène et gérer proprement les bandes ou le recadrage selon le mode de scale choisi.
- Le comportement doit rester correct sur une fenêtre desktop redimensionnée.

## Structure indicative

Adapter cette structure au dépôt existant au lieu de tout réorganiser sans raison :

```text
src/
  main.ts
  game/
    config.ts
    scenes/
      ArenaScene.ts
    systems/
      # réservé aux systèmes futurs, ne rien ajouter sans besoin actuel
  styles/
    main.css
public/
  assets/
    backgrounds/
    fighters/
docs/
  01-CONTEXTE-PROJET.md
  02-DIRECTION-ARTISTIQUE.md
  03-ARCHITECTURE-TECHNIQUE.md
  04-ROADMAP-ET-PERIMETRE.md
  05-CRITERES-DE-VALIDATION.md
```

Si le projet possède déjà une structure, examiner celle-ci et la préserver autant que possible.

## Responsabilités minimales de l'étape 1

- configuration Vite et TypeScript ;
- configuration Phaser avec rendu WebGL ;
- scène `ArenaScene` ;
- chargement d'un arrière-plan disponible, si l'asset est identifié et correctement référencé ;
- affichage d'une scène minimale et d'un sol/horizon ;
- adaptation à la fenêtre ;
- nettoyage correct des ressources/événements si nécessaire ;
- instructions de lancement et de validation.

## Qualité

- Pas de dépendance inutile.
- Pas de grosse architecture abstraite avant qu'elle soit justifiée.
- Pas de `any` non justifié.
- Pas de chemin d'asset supposé : vérifier les fichiers réellement présents.
- Fournir des messages d'erreur utiles en cas d'asset manquant.
- Ne pas annoncer des tests réussis s'ils n'ont pas été exécutés.

---

# Architecture réelle après le sprint 2

Cette section décrit le code tel qu'il existe. En cas d'écart avec la cible ci-dessus, c'est elle qui fait foi.

## Stack installée

- Vite 8, TypeScript 7 (strict), React 19, React Router 7.
- Le jeu de l'arène : le moteur WebGL de `../game/` (TypeScript, shaders écrits à la main, sans bibliothèque),
  importé par l'alias `@game`. Phaser a été retiré le 27 octobre 2026.
- Polices auto-hébergées via `@fontsource` : Anton (titres), Chakra Petch (HUD du site), Barlow Semi Condensed
  (interface de combat, cinématique et écran de chargement du jeu). Le texte courant utilise la police système.
- Vitest pour les tests unitaires (ceux du site et ceux de `../game/src`).
- CSS natif, sans préprocesseur ni bibliothèque d'animation.

## L'arène : le jeu de `../game/`

Jusqu'au 27 octobre 2026, l'arène était une réécriture en Phaser du lab, reportée à la main et toujours en retard.
Elle affiche désormais le jeu lui-même : moteur et images dans `../game/`, mis au point dans le lab, reçus ici sans
report (voir `../game/README.md`).

| Fichier | Rôle |
|---|---|
| `src/components/GameArena.tsx` | Crée les canvas du jeu (décor, mannequin caché, Shigaraki, Moussa, météo, cinématique et interface) et le moteur (`StageEngine`) au montage, le détruit au démontage. Options d'un combat : pluie, pétales, adversaire Shigaraki, « Réduire les animations » suivant le système. Bouton « Passer » pendant les plans de la cinématique. |
| `src/components/ArenaLoading.tsx` | L'écran de chargement du lab (VS, noms, astuces, jauge du vrai chargement), en CSS du site. Une fois tout chargé, il lance la partie : la cinématique démarre derrière lui, qui s'efface par-dessus. |
| `src/data/arena.ts` | Ses textes : noms (« Mouss, combattant », « Shigaraki, le boss final ») et astuces. |
| `../game/src/controls.ts` | Le clavier du joueur (`bindPlayerKeys`), testé : marche, double appui (dash, drive rush), accroupi, parade, saut, coups, boule de feu, attaque finale, Échap. Il n'écoute qu'une fois la partie lancée. |
| `src/pages/Training.tsx` | La page : charge `GameArena` à la demande (`React.lazy`), plein écran (`useFullscreen` : bouton en bas au milieu de l'écran de jeu, touche F), aide des touches. |
| `vite.config.ts` | Alias `@game`, et `gamePublic` : les images de `../game/public/` servies en développement et recopiées dans `dist/` au build, à côté de celles de `public/`. |

- **Ce que le site ne prend pas du lab** : ses touches et options d'essai (O, P, K, M, N, cases à cocher), le
  mannequin, le contrôle de l'adversaire, le carton de titre « Stage ». Le lab garde sa propre lecture du clavier
  (`../lab/src/App.tsx`).
- **Taille** : le jeu tient en 16:9 dans l'écran de jeu (`.game-stage`), et le moteur dimensionne ses canvas sur
  lui. En plein écran, il garde son 16:9, centré sur fond noir.
- **Poids** : le code du jeu fait quelques centaines de Ko, mais ses images environ 114 Mo, toutes chargées avant
  le combat. À compresser avant la mise en ligne.
- **Tactile** : pas de commandes au doigt.
- Le fonctionnement du jeu (caméra, personnages, coups, interface de combat, cinématique) est décrit dans
  `../lab/docs/ARCHITECTURE.md`.

## Routage

- `BrowserRouter`, avec des adresses lisibles (`/projets/racine-eyewear`).
- Conséquence pour l'hébergement : le serveur doit renvoyer `index.html` pour toute adresse inconnue
  (réécriture SPA). Sans cela, recharger une page interne donne une erreur 404.
- L'intro n'est montrée d'office qu'à la première visite (mémorisée dans `localStorage`) ; elle reste accessible
  sur `/intro`.

## Données

Tous les contenus sont dans `src/data/`. Une valeur `null` ou une liste vide signifie « à fournir » et s'affiche
comme telle. Voir `06-CONTENUS-A-FOURNIR.md`.

## Styles

- `main.css` : jetons (couleurs, polices, espacements), base, décor, animations, `prefers-reduced-motion`.
- `components.css` : en-tête, menu mobile, boutons, panneaux HUD, portraits, visuels de projet, cadre de l'arène.
- `pages.css` : mise en page de chaque écran, écrite mobile d'abord. Le passage en disposition desktop se fait
  à 960 px.

## Décisions à connaître

- Les boutons et cartes sont inclinés par `transform: skew` plutôt que découpés par `clip-path`, pour que le
  contour de focus clavier reste visible.
- L'animation d'entrée de page ne joue que sur l'opacité de `<main>` : un `transform` à cet endroit casserait
  les décors en position fixe.
- Le rouge des boutons pleins est `#D4142D` (et non `#F51F3B`) pour garder un contraste suffisant avec le texte
  blanc.
