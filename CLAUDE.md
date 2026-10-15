# Consignes pour travailler sur ce dépôt

Portfolio de Moussa Sagna, développeur frontend, sous forme de jeu de combat 2D (style Guilty Gear Strive). Le dépôt contient deux projets côte à côte et des ressources communes.

## Organisation

| Dossier | Rôle |
| --- | --- |
| `lab/` | Moteur WebGL d'essai : on y met au point le stage et les animations du personnage. Voir `lab/CLAUDE.md`. |
| `folio/` | Le portfolio Phaser, le site qui sera mis en ligne. |
| `art/` | Illustrations sources du personnage, une par pose. Communes aux deux projets. |
| `docs/` | Documentation commune (direction artistique). |

**Pour reprendre le travail** (nouvelle conversation) : lire `docs/ETAT-DU-PROJET.md`, qui dit où en est le projet, comment on travaille avec Moussa (illustrations générées par lui, lab d'abord, aperçu publié, fusion, report dans le folio) et ce qui reste à faire. Le tenir à jour à chaque fusion dans `main`.

Chaque projet a son propre `package.json` : les commandes se lancent depuis `lab/` ou depuis `folio/`, jamais depuis la racine. Chaque projet a aussi son propre `CLAUDE.md`, qui complète celui-ci.

## Règles communes

- **Langue** : interface et documentation en français, avec les accents. Noms de code (variables, fichiers, types) en anglais.
- **Un projet à la fois** : un changement dans `lab/` ne touche pas à `folio/`, et inversement. Ce qui passe de l'un à l'autre (images découpées, réglages d'animation) est reporté volontairement et noté dans le message de commit.
- **Illustrations** : une seule copie de chaque source, dans `art/`. Ne pas dupliquer une illustration dans un projet ; seuls les fichiers générés à partir d'elle (atlas, données) y vivent.
- **Fichiers lourds** : pas d'archives ni de dossiers de références dans le dépôt. Seul ce dont un projet a besoin pour se construire ou s'exécuter est suivi.
- **Vérifier un changement de rendu** : un build qui passe ne prouve pas que le rendu est bon. Ouvrir la page, regarder réellement l'écran, et dire clairement ce qui a été vérifié à l'œil et ce qui ne l'a pas été.

## Le personnage

- Toutes ses poses gardent la même vue (trois quarts à profil, tourné vers la droite) et la même taille de tête. Une pose dans une autre vue fait sauter le personnage au changement d'état.
- Une animation = une illustration animée par le moteur. Faire alterner plusieurs illustrations générées dans une même animation continue produit une saccade à chaque changement de dessin.
- Les illustrations générées portent parfois un logo de marque sur les baskets : il doit être effacé avant toute mise en ligne.
- Les personnages d'autres éditeurs (Ryu, M. Bison…) sont protégés : pour un site public, préférer des adversaires originaux.
