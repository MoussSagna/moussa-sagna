# Lab : moteur WebGL d'essai

Le lab sert à mettre au point le stage et les animations du personnage avant de les reporter dans le portfolio (`../folio/`). Ce n'est pas le site mis en ligne.

Écran en place : le stage **Tokyo Underground**, animé et en profondeur, avec le personnage en garde.

## Commandes

Tout se joue au clavier (il n'y a plus de boutons sous la scène).

| Action | Clavier |
| --- | --- |
| Avancer | maintenir → ou D |
| Reculer | maintenir ← ou Q (A sur un clavier QWERTY) |
| Dash avant ou arrière | deux appuis rapides dans le même sens |
| S'accroupir | maintenir ↓ ou S |
| Parer (debout ou accroupi) | maintenir Espace |
| Attaquer | J : un appui pour le coup léger, un second pour enchaîner le coup moyen, un troisième pour le coup fort, un quatrième pour le coup de pied. L'enchaînement ne continue que si le coup touche ; L pendant un coup qui touche l'annule en boule de feu |
| Attaque spéciale (boule de feu) | L |
| Sauter (avec une direction tenue : saut avant ou arrière) | ↑ ou Z (W sur un clavier QWERTY) |
| Seconde attaque spéciale (frappe au sol) | I |
| Passer la cinématique d'entrée | Échap (ou le bouton « Passer ») |
| Perdre par K.O. (puis round suivant) | O |
| Finir le round (sortie du personnage, puis round suivant) | P |
| Faire attaquer le mannequin ou l'adversaire (pour tester les coups reçus et parés) | K |

Les directions suivent l'écran : quand les combattants ont changé de côté, → et D vont toujours vers la droite.

### Contrôler l'adversaire

La case « Contrôler l'adversaire » donne les flèches à l'adversaire ; Moussa se joue alors avec Q D, S, Z, Espace et les touches d'attaque.

| Action de l'adversaire | Clavier |
| --- | --- |
| Avancer vers Moussa, en lévitation | maintenir la flèche vers Moussa (← au départ) |
| Reculer | maintenir l'autre flèche |
| Téléportation avant (dans le dos de Moussa au corps à corps : les combattants changent de côté) | deux appuis rapides vers Moussa |
| Téléportation arrière | deux appuis rapides à l'opposé |
| Parer | maintenir ↓ |
| Début de l'attaque ultime (mise au point sur lui) | N |
| Coup spécial (annule n'importe quel coup de l'enchaînement) | Maj (ou M, même quand il n'est pas contrôlé) |
| Coup de poing, puis coup de pied, coup de marteau, uppercut et coup de pied final, à chaque nouvel appui | Entrée (ou K, même quand il n'est pas contrôlé) |

Laissé seul (case décochée), il garde ses distances avec Moussa en lévitant ; la case « L'adversaire se déplace » le fige.

## Démarrer

Depuis `lab/` :

```bash
npm install
npm run dev      # serveur de développement
npm run build    # vérification TypeScript + build de production dans dist/
npm run preview  # sert le build de production
npm run lint     # oxlint
```

Node 20 ou plus récent.

## Technologies

- **Vite + React 19 + TypeScript** pour l'application.
- **Tailwind CSS 4** pour l'interface (les couleurs et polices sont des jetons dans `src/index.css`).
- **WebGL (shaders écrits à la main)** pour le décor et le personnage, **Canvas 2D** pour la pluie et les pétales.

Aucune bibliothèque de jeu n'est installée pour l'instant : le premier écran n'en a pas besoin. Voir `docs/ROADMAP.md` pour le moment où PixiJS, GSAP ou Zustand deviendront utiles.

## Organisation

```
../art/          illustrations du personnage (une par pose), à la racine du dépôt
moussa_rig/      ancien rig de face, plus utilisé par le moteur
public/assets/   images du stage et du personnage
src/game/        moteur de rendu, indépendant de React
src/components/  écrans et interface React
docs/            architecture, assets, feuille de route
tools/           scripts Python de préparation des images
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) : comment l'écran est rendu, comment le personnage est animé et comment ajouter un plan.
- [Direction artistique](../docs/DIRECTION_ARTISTIQUE.md) : palette, typographie, ton (commune au lab et au folio).
- [Assets](docs/ASSETS.md) : préparer un décor ou une pose du personnage.
- [Feuille de route](docs/ROADMAP.md) : ce qui est fait et ce qui reste.
