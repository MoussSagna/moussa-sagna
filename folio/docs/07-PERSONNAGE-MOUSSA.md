# Personnage Moussa — assets et références

> Le dossier `references/` cité ci-dessous n'est pas suivi par git : trop lourd, il reste en local à la racine
> de la copie de travail. Le site n'en a pas besoin pour se construire.

Tous les visuels de Moussa sont extraits des deux planches fournies, sans redessin, sans recoloration et sans
déformation. Les fichiers sources ne doivent pas être modifiés.

| Source | Fichier | Rôle |
|---|---|---|
| Planche transparente (1536 × 1024, fond transparent) | `references/planche-moussa-transparente.png` | Source de tous les visuels du site |
| Fiche de combat (1774 × 887) | `references/fiche-moussa-vs-bison.png` | Fiche technique et planches de mouvements de Moussa, pour référence |

## Assets utilisés par le site

Dossier : `public/assets/fighters/moussa/`. Ils sont déclarés dans `src/data/fighters.ts`.

| Fichier | Contenu | Taille | Utilisé sur |
|---|---|---|---|
| `stance.webp` | Pose de face, poings serrés, fond transparent | 355 × 663 | Accueil |
| `portrait.webp` | Grand portrait de profil, fond transparent | 500 × 520 | Intro, À propos |
| `expression-1.webp` à `-4.webp` | Les quatre expressions | environ 95 × 211 | À propos |

Les fichiers sont à la taille d'origine de la planche, sans agrandissement.

Pour l'arène (`/entrainement`), le personnage jouable utilise d'autres fichiers, repris de
`lab/` : les vingt fichiers de `poses/` (`guard.webp`, `walk.webp`, `crouch.webp`, `punchHit.webp`…). Ce
sont des atlas de calques tirés de vingt illustrations en pied, pas des découpes de la planche. Voir « Personnage jouable » dans
`03-ARCHITECTURE-TECHNIQUE.md`.

### Comment ils ont été découpés

- **Séparation des éléments** : la planche a un vrai fond transparent. Chaque élément est isolé à partir de
  cette transparence, pas par une détection de couleur.
- **Pose de face** : elle touche le grand portrait sur sa gauche (mèches, écharpe et flammes rouges). Cette
  frontière a été tracée à la main le long du contour du personnage. Le ruban rouge qui arrivait sur son épaule
  droite appartient au bandeau de la pose de profil voisine : il a été retiré.
- **Portrait** : recadrage de la zone x 0–500, y 0–520. Ses flammes gardent leur transparence d'origine.
- **Expressions** : recadrages rectangulaires, bornes lues dans la transparence
  (y 12–223 ; x 1113–1212, 1219–1315, 1323–1418, 1425–1512).

### Limites connues

- **Écharpe de la pose de face** : un pan rouge part du coude gauche vers la gauche. Impossible de dire avec
  certitude s'il appartient au personnage ou au décor du grand portrait ; il a été coupé au ras du coude. À
  confirmer.
- **Écrans haute densité** : sur l'accueil desktop le personnage est affiché jusqu'à 580 px de haut pour un
  fichier de 663 px. C'est net sur un écran standard, un peu juste sur un écran Retina, où il faudrait une
  image deux fois plus grande.
- **Portrait** : le cadre des pages le recadre autour du visage ; la partie basse (épaule, flammes) n'est
  visible qu'en partie.

## Références conservées pour la suite

Ces fichiers ne sont pas publiés avec le site.

`references/moussa/planche-transparente/` — éléments de la planche transparente, isolés sur fond transparent :

- `pose-face.png`, `pose-profil.png`, `pose-profil-2.png`, `poses-trois-quarts-dos-et-dos.png` (ces deux poses
  se touchent et n'ont pas été séparées) ;
- `portrait-complet.png` ;
- `action-garde.png`, `action-dash.png`, `action-coup-de-pied.png`, `action-coup-energie.png`,
  `action-projectile-bas.png`, `action-accroupi.png`.

Les découpes d'action sont des regroupements automatiques : les noms décrivent ce qu'on y voit, sans garantie
qu'ils correspondent aux noms de coups prévus. Deux d'entre elles sont coupées par le bord bas de la planche.

`references/moussa/sequences/` — recadrages bruts des huit planches de mouvements de la fiche de combat
(idle/garde, marche, dash, saut, accroupi, poings, pieds, spéciales), sans leurs titres.

## Peut-on en tirer des animations ?

Pas encore. Aucune animation n'a été créée.

**Planche transparente** : six illustrations d'action, grandes et de bonne qualité, mais ce sont des poses
uniques. Elles peuvent servir d'images clés ou d'illustrations (écran de coup spécial, page concept), pas de
séquences animées. Les effets (énergie, poussière, flammes) sont fusionnés avec le personnage.

**Fiche de combat** : elle contient de vraies séquences, mais inexploitables telles quelles :

| Planche | Images | Remarques |
|---|---|---|
| Idle / garde | 3 | Poses proches, pourraient suggérer une respiration |
| Marche | 3 | Pas un cycle complet |
| Dash | 2 | Traînées de poussière fusionnées avec le personnage |
| Saut | 3 | Montée, sommet, descente |
| Accroupi | 2 | |
| Attaques de poing | 5 | Une à deux images par coup |
| Attaques de pied | 3 | Une image par coup |
| Attaques spéciales | 7 | Effets fusionnés avec le personnage |

- les images y font 45 à 75 px de haut, bien trop peu pour une arène de 1280 × 720 ;
- elles ne suivent pas une grille régulière et se chevauchent par endroits ;
- la hauteur du sol et l'échelle varient d'une image à l'autre ;
- deux ou trois poses par mouvement ne suffisent pas pour une animation fluide ;
- le fond est sombre mais pas transparent.

Enfin, les deux planches ne montrent pas tout à fait le même dessin du personnage (proportions, détails de la
veste) : des sprites tirés de l'une ne s'accorderaient pas avec les illustrations de l'autre.

## À préparer pour l'étape « présence du personnage »

1. De vraies feuilles de sprites dans le style de la planche transparente : images de taille identique, sol
   aligné, fond transparent, effets sur des calques séparés, et assez d'images par mouvement (idle et marche en
   priorité).
2. Une version deux fois plus grande de la pose de face, pour les écrans haute densité.
3. La confirmation du pan d'écharpe au coude gauche.

## L'adversaire

L'adversaire n'a aucun visuel : ses emplacements sont des cadres « visuel à fournir », en attendant un
personnage original. Voir `06-CONTENUS-A-FOURNIR.md`.
