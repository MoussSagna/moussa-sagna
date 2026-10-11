# Lab : moteur WebGL d'essai

Le lab sert à mettre au point le stage et les animations du personnage avant de les reporter dans le portfolio (`../folio/`). Ce n'est pas le site mis en ligne.

Écran en place : le stage **Tokyo Underground**, animé et en profondeur, avec le personnage en garde.

## Commandes du personnage

| Action | Clavier | Boutons |
| --- | --- | --- |
| Avancer | maintenir → ou D | maintenir « Avancer » |
| Reculer | maintenir ← ou Q (A sur un clavier QWERTY) | maintenir « Reculer » |
| Dash avant ou arrière | deux appuis rapides dans le même sens | deux appuis rapides sur le bouton |
| S'accroupir | maintenir ↓ ou S | maintenir « S'accroupir » |
| Parer (debout ou accroupi) | maintenir Espace | maintenir « Parer » |
| Sauter | ↑ ou Z (W sur un clavier QWERTY) | « Sauter » |

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
