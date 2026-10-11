# Moussa Sagna — portfolio en mode jeu de combat

Portfolio de Moussa Sagna, développeur frontend, présenté comme un jeu de combat 2D dans l'esprit de *Guilty Gear Strive*.

Le dépôt contient deux projets :

| Dossier | Contenu | État |
| --- | --- | --- |
| [`lab/`](lab/README.md) | Moteur WebGL d'essai : stage Tokyo Underground, garde, marche, dashs, accroupi, parade et saut du personnage. | En place |
| [`folio/`](folio/README.md) | Le portfolio Phaser, le site qui sera mis en ligne : pages React et arène jouable (garde, marche, dashs). | En place |

Et des ressources communes :

- `art/` : les illustrations sources du personnage, une par pose.
- [`docs/DIRECTION_ARTISTIQUE.md`](docs/DIRECTION_ARTISTIQUE.md) : palette, typographie, ton, personnage.
- `CLAUDE.md` : consignes communes pour les agents ; chaque projet a aussi les siennes.

## Démarrer

Chaque projet s'installe et se lance depuis son propre dossier :

```bash
cd lab
npm install
npm run dev
```

## Du lab au folio

Une animation est d'abord mise au point dans `lab/`, à partir d'une illustration de `art/`. Une fois validée, ses images découpées et ses réglages (durées, distances, échelles) sont reportés dans `folio/`. Le détail du fonctionnement du lab est dans [`lab/docs/ARCHITECTURE.md`](lab/docs/ARCHITECTURE.md).
