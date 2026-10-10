# Rig 2D de Moussa : calques pour la pose neutre

Ce dossier contient l'illustration de Moussa découpée en 17 calques, prête pour une animation de respiration avec rubans. Il est produit par `tools/prepare_rig.py` à partir du maître, qui n'est jamais modifié.

**État : séparation et recouvrements faits et testés, animation finale non produite.** La boucle fournie dans `05_apercus/` est un test de validation en 24 images, pas les 60 images définitives. Voir « Ce qui reste à faire » avant de valider.

## Contenu

| Dossier | Contenu |
| --- | --- |
| `00_maitre/` | Copie octet pour octet du maître original. |
| `01_base/` | `master_repaired.png` : copie réparée qui sert de référence aux calques. Les deux masques `repair_*` montrent exactement ce qui a été changé. `labels_overlay.png` montre la découpe. |
| `02_calques/` | Les 17 calques PNG RGBA, 1024 × 1536, même origine que le maître. |
| `03_masques/` | Un masque par calque (voir « Lire un masque »). |
| `04_source/` | `moussa_rig.ora` : fichier OpenRaster à ouvrir dans Krita ou GIMP, calques groupés et dans le bon ordre, maître original inclus en calque masqué. |
| `05_apercus/` | Composition sur fonds clair, sombre et damier, tests de mouvement, gros plans. |
| `rig.json` | Ordre d'empilement, hiérarchie, pivots et mouvement proposé. |
| `calques.json` | Boîte englobante et nombre de pixels de chaque calque. |

## Pourquoi une copie réparée

Le maître fourni avait deux défauts de détourage, corrigés dans `01_base/master_repaired.png` et nulle part ailleurs :

- **Blancs troués.** Le détourage d'origine avait effacé les blancs les plus clairs avec le fond : débardeur, chaussures, croix des gants, boucles. 7 399 pixels entièrement effacés ont été rebouchés à partir de leurs voisins, et 27 532 pixels internes semi-transparents ont été rendus opaques avec leur propre couleur.
- **Restes de faux damier.** Entre les rubans, sous le nœud du bandeau, entre le gant gauche et la veste et au bord des dreads, il restait des lignes claires du damier d'origine, visibles sur fond sombre. 17 880 pixels ont été retirés.

Rien d'autre n'a été touché : hors de ces deux masques, la copie réparée est identique au maître.

## Les calques

Du fond vers le premier plan :

| N° | Calque | Contenu | Parent | Pivot (x, y) |
| --- | --- | --- | --- | --- |
| 01 | `rb_long` | ruban long supérieur gauche | torse | 432, 208 |
| 02 | `rb_mid` | ruban central gauche (deux brins croisés) | torse | 318, 350 |
| 03 | `rb_low` | ruban inférieur gauche | torse | 262, 615 |
| 04 | `rb_bottom` | ruban du bas, derrière le gant gauche | torse | 286, 772 |
| 05 | `rb_hip` | pan qui descend derrière la hanche gauche | bas du corps | 356, 866 |
| 06 | `rb_right` | pan qui descend à droite | bas du corps | 850, 848 |
| 07 | `rb_top` | ruban supérieur arrière | tête | 532, 125 |
| 08 | `rb_knot` | petit ruban du nœud | tête | 530, 165 |
| 09 | `lower` | ceinture, pantalon, lanières fixées, chaussures | racine, fixe | 560, 1500 |
| 10 | `torso` | cou, poitrine, collier, débardeur | bas du corps | 610, 640 |
| 11 | `arm_r` | avant-bras et gant droits | manche droite | 810, 578 |
| 12 | `jacket` | capuche et pans de la veste | torse | 610, 640 |
| 13 | `arm_l` | avant-bras et gant gauches | manche gauche | 330, 560 |
| 14 | `sleeve_r` | épaule et manche droites | veste | 735, 300 |
| 15 | `sleeve_l` | épaule et manche gauches | veste | 400, 290 |
| 16 | `head` | visage, oreille, haut du cou en fondu | torse | 590, 215 |
| 17 | `hair` | dreads et bandeau | tête | 620, 120 |

Les coordonnées sont en pixels du maître, origine en haut à gauche. Tous les calques ont la taille de la toile : il suffit de les empiler sans les déplacer pour retrouver l'image.

### Trois types de bord

- **Bord sur un contour dessiné** (gant, ourlet, mâchoire, revers) : coupe nette. Le calque du dessous est prolongé de 10 à 14 pixels sous celui du dessus, 28 pixels pour les rubans.
- **Bord en plein tissu** (manche contre veste) : pas de contour à suivre, donc la manche se termine par un fondu de 14 pixels et la veste garde dessous les vrais pixels du maître. Rien n'est inventé à cet endroit.
- **Cou** : la tête se prolonge dans le cou par un fondu de 18 pixels, et le torse garde tout le cou.

### Lire un masque

Chaque masque de `03_masques/` a trois niveaux de gris :

- **255** : zone visible au repos, pixels du maître ;
- **160** : vrais pixels du maître gardés en recouvrement, cachés ou fondus au repos ;
- **80** : pixels **reconstruits**, donc inventés. C'est un prolongement de la couleur intérieure du calque, adouci. Ce n'est pas un redessin : ni plis, ni traits, ni motifs.

## Utiliser les calques pour l'animation

`rig.json` décrit le mouvement utilisé pour le test. Cycle de 4 secondes, toutes les courbes sont des sinus du cycle, donc la boucle revient exactement à la pose de départ.

- **Bas du corps** : fixe.
- **Torse** : mise à l'échelle autour de la taille (610, 640), +0,5 % en largeur et +0,9 % en hauteur à l'inspiration. Les épaules montent d'environ 3 pixels, l'ourlet ne bouge pas.
- **Veste et manches** : suivent toute la transformation du torse, pour rester soudées. Les manches ajoutent une rotation de 0,25° autour de l'épaule.
- **Avant-bras et gants** : suivent leur point d'attache sans se déformer, avec 0,3° de rotation et un léger retard.
- **Tête** : suit le cou, 0,45° de rotation en retard sur la respiration. Les cheveux suivent la tête avec 0,12° de plus.
- **Rubans** : rotation de 0,8° à 1,2° autour de la racine, plus une ondulation perpendiculaire à l'axe, nulle à la racine et de 2 à 7 pixels à la pointe. Chaque ruban a sa propre phase, d'où le mouvement décalé.

Deux modes d'héritage, indiqués par `follow` : `matrix` (le calque hérite de toute la transformation du parent) et `point` (il suit seulement le déplacement de son pivot).

**Marge de sécurité.** Tant qu'un calque ne s'écarte pas de plus de 10 pixels de son voisin (25 pour la racine d'un ruban), il n'y a pas de trou. Au-delà, on sort de la matière reconstruite.

## Contrôle qualité effectué

Mesuré par le script :

- La recomposition des 17 calques est identique à la copie réparée, écart nul sur toutes les couches.
- Le maître du dossier `moussa_rigging_stage/` est inchangé (empreinte SHA-256 vérifiée avant et après).
- Sur les 24 images du cycle : au pire 1 443 pixels reconstruits deviennent visibles (sur 760 000) et 5 pixels de trou apparaissent. À amplitude doublée : 3 421 pixels reconstruits et 51 pixels de trou.

Vérifié à l'œil, sur les images de `05_apercus/` :

- composition au repos sur fond clair, sombre et damier ;
- planche de 4 poses à amplitude normale et doublée ;
- gros plans à amplitude doublée sur le cou, les deux poignets, l'épaule gauche, la taille et les rubans : aucun trou ni raccord visible, sauf le point signalé ci-dessous.

Non vérifié :

- la boucle animée (`test_boucle_24_images.webp` et `.gif`) n'a pas été regardée en mouvement, seulement image par image ;
- `moussa_rig.ora` n'a pas été ouvert dans Krita, seule sa structure a été contrôlée ;
- rien n'a été testé dans le moteur du portfolio ni à sa taille d'affichage réelle.

## Ce qui reste à faire

1. **Regarder la boucle de test en mouvement** et valider ou corriger les amplitudes de `rig.json`.
2. **Repeindre à la main les zones reconstruites si l'animation doit bouger davantage.** Les pixels de niveau 80 des masques suffisent pour une respiration, pas pour un coup ou une rotation franche. Les plus sommaires : le torse sous la veste (19 211 px), le haut du pantalon sous le débardeur et les gants (8 864 px), la capuche sous la tête (11 227 px).
3. **Défaut connu, poing droit** : à amplitude doublée, un éclat rouge de quelques pixels apparaît sous le poing droit (lanière reconstruite). Invisible à amplitude normale.
4. **Rubans croisés non séparés** : `rb_mid` contient deux brins qui se croisent. Les séparer demanderait de redessiner la partie cachée de l'un des deux.
5. **Lanières du pantalon** : la lanière à boucle de droite et les chaînes restent dans `lower`, donc fixes.
6. **Choix à confirmer** : la zone entre le gant gauche et le bas de la veste (autour de 395, 705) a été traitée comme un vide laissant voir le fond. Si c'était du débardeur blanc, il faut la reboucher.
7. **Débardeur** : les blancs rebouchés sont une interpolation, les valeurs d'origine sont perdues. Le résultat est propre mais pas garanti identique à l'illustration avant détourage.
8. **Production des 60 images et intégration au moteur** : pas commencées, en attente de validation.

## Régénérer

```bash
python3 -m venv .venv-rig && .venv-rig/bin/pip install pillow numpy opencv-python-headless scipy
.venv-rig/bin/python tools/prepare_rig.py moussa_rigging_stage/00_MOUSSA_MASTER_UNTOUCHED.png
```

Les polygones et lignes de coupe de `tools/rig/segment.py` sont tracés à la main pour cette illustration. Une autre image demande de les retracer.
