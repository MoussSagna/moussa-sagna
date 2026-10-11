# Roadmap et périmètre

## Étape 1 — Socle technique (terminée)

**Inclus :**
- projet Vite + TypeScript ;
- Phaser configuré ;
- rendu WebGL ;
- scène d'arène minimale ;
- décor existant si disponible ;
- dimension logique de référence 1280 × 720 ;
- redimensionnement responsive ;
- critères de validation et documentation.

**Exclus :**
- animations du personnage ;
- idle/guard, marche avant ou arrière, dash, saut ;
- contrôles de jeu ;
- attaques, hitboxes, dégâts, combos et effets d'impact ;
- adversaire piloté par IA ;
- système de combat ;
- écran d'accueil final et navigation complète du portfolio ;
- audio, cinématiques et effets complexes.

## Étape 2 — Interface du portfolio (réalisée, contenus à compléter)

Réalisé : les neuf écrans (intro, accueil, sélection, étude de cas, à propos, parcours, arène/concept, contact,
page de secours) et la navigation mobile. Reste à fournir : portraits des personnages, visuels et textes des
projets, missions du parcours, coordonnées. Voir `06-CONTENUS-A-FOURNIR.md`.

Périmètre d'origine :
- interface React ;
- écran d'accueil inspiré d'un écran de sélection de combat ;
- navigation Accueil / Projets / À propos / Contact ;
- sélection de projets et pages de détail ;
- intégration du canvas Phaser sans couplage excessif ;
- responsive desktop et mobile.

## Étape 3 — Présence du personnage

Après validation de la direction et des assets :
- intégration des sprites de Moussa ;
- affichage du personnage dans l'arène ;
- animation de garde/idle ;
- marche avant et arrière ;
- gestion du clavier et des états de mouvement ;
- boucle de jeu stable.

Cette étape devra réutiliser les assets validés et ne pas substituer un personnage au design différent.

## Étape 4 — Mini-expérience jouable

À cadrer séparément :
- sauts et déplacements supplémentaires ;
- interactions dans l'arène ;
- séquence d'entrée ou de victoire ;
- mode entraînement ou petite interaction ludique ;
- contrôles accessibles et possibilité de quitter le mini-jeu pour revenir au portfolio.

## Étape 5 — Prototype de combat (optionnel)

Uniquement si le projet est toujours pertinent :
- attaques et priorités ;
- hitboxes/hurtboxes ;
- collisions, hitstun et récupération ;
- barre de vie et conditions de victoire ;
- adversaire simple ;
- tests de gameplay et équilibrage.

Un jeu de combat complet ne constitue pas l'objectif initial du portfolio.
