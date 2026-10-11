# Direction artistique — Tokyo Underground

## Références fournies

Les images de référence du projet montrent :
- un décor de Tokyo nocturne sous la pluie, avec lune rouge et reflets au sol ;
- des cerisiers en fleurs, lanternes, ponts, toits traditionnels et skyline moderne ;
- une palette dominée par le noir bleuté, le rouge écarlate, le cyan et le magenta ;
- des concepts de personnage et des fiches de mouvements façon jeu de combat ;
- un écran de lancement de combat avec Moussa face à un adversaire.

Ces images servent de références d'ambiance et de composition. Elles ne doivent pas être redessinées ou remplacées arbitrairement si les assets originaux sont disponibles.

## Palette indicative

- Fond nuit : `#070B12`
- Bleu nuit : `#101D2D`
- Rouge principal : `#F51F3B`
- Rouge sombre : `#8E1027`
- Cyan néon : `#29C8F2`
- Magenta néon : `#E33CCB`
- Blanc froid : `#F2F4F7`
- Gris interface : `#7F8A9A`

Les couleurs peuvent être ajustées après comparaison avec les références. Éviter d'utiliser tous les néons à intensité maximale en même temps.

## Ambiance

- Jeu de combat 2D stylisé, dynamique et cinématique.
- Décor dense, mais lisibilité prioritaire dans la zone centrale.
- Contraste entre silhouette sombre et accents rouges.
- Cadres fins, lignes techniques, panneaux HUD et typographie condensée.
- Effets de pluie et de particules réservés aux phases ultérieures, sauf si une image de fond les contient déjà.

## Écran d'accueil futur

Éléments prévus à terme :
- logo/nom « MOUSSA » ;
- mention « Creative Developer / Portfolio » ;
- navigation : Accueil, Projets, À propos, Contact ;
- titre central « TOKYO UNDERGROUND » ;
- baseline « Design • Code • Interactive Worlds » ;
- CTA « Entrer dans l'arène » ;
- CTA secondaire « Voir les projets » ;
- bandeaux HUD en bas, inspirés des barres de vie d'un jeu de combat ;
- cartes de projets illustrées.

**Ces éléments appartiennent à la direction cible et ne font pas partie de l'implémentation de l'étape 1**, sauf demande explicite ultérieure.

## Arène minimale de l'étape 1

Pour le premier sprint, utiliser le décor fourni s'il est déjà présent dans le dépôt. À défaut, afficher un fond temporaire sobre avec un sol ou une ligne d'horizon clairement visible. Ne pas générer de nouvel asset sans nécessité.

La scène doit surtout démontrer que Phaser, le canvas WebGL et le redimensionnement fonctionnent.

## Choix appliqués au sprint 2

- **Stage** : un seul décor existe (`stage.webp`, identique au PNG source en plus léger). Il sert de fond à
  l'accueil, à l'intro, au contact, au parcours, à la sélection et à la page de secours, toujours recadré
  (`object-fit: cover`), jamais étiré, sous un voile sombre plus ou moins dense selon la quantité de texte.
- **Couleurs des combattants** : rouge pour Moussa (P1), violet `#8B35F5` pour l'adversaire (CPU).
- **Typographie** : Anton pour les titres, Chakra Petch pour les libellés d'interface, police système pour le
  texte courant.
- **Personnages** : Moussa est intégré depuis sa planche transparente (sprint 2.1) : en pied, de face, sur
  l'accueil, avec un liseré et un halo rouges ; en portrait de profil dans l'intro et la page À propos.
  L'adversaire n'a pas encore de visuel : l'accueil et l'intro affichent un cadre violet « visuel à fournir »,
  en attendant un personnage original. Rien n'a été dessiné ni généré.
