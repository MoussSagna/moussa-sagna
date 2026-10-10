# Moussa Sagna — portfolio en mode jeu de combat

Portfolio de Moussa Sagna, développeur frontend, présenté comme un jeu de combat 2D dans l'esprit de *Guilty Gear Strive*.

Premier écran en place : le stage **Tokyo Underground**, animé et en profondeur, avec le personnage en position neutre. Il marche avec les flèches gauche et droite (ou Q et D).

## Démarrer

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
art/             illustration d'origine du personnage
public/assets/   images du stage et du personnage
src/game/        moteur de rendu, indépendant de React
src/components/  écrans et interface React
docs/            architecture, direction artistique, assets, feuille de route
tools/           scripts Python de préparation des images
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) : comment l'écran est rendu et comment ajouter un plan.
- [Direction artistique](docs/DIRECTION_ARTISTIQUE.md) : palette, typographie, ton.
- [Assets](docs/ASSETS.md) : préparer un décor ou un personnage.
- [Feuille de route](docs/ROADMAP.md) : ce qui est fait et ce qui reste.
