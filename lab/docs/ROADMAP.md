# Feuille de route

## Fait

- [x] Projet initialisé (Vite, React, TypeScript, Tailwind).
- [x] Stage Tokyo Underground : profondeur, ciel, écrans, lanternes, métro, brume, sol mouillé, pluie, pétales.
- [x] Carton de titre et travelling d'ouverture.
- [x] Personnage en garde de trois quarts : respiration, léger rebond sur les appuis, tête et rubans animés.
- [x] Marche avant et arrière, jambes et bras articulés à partir d'une seule illustration, avec une pose intermédiaire au départ et à l'arrêt.
- [x] Dash avant et dash arrière au double appui, avec images fantômes.
- [x] Accroupi maintenu, avec une pose à mi-descente.
- [x] Parade debout et parade accroupie, maintenues à la main (à juger en mouvement).
- [x] Saut vertical en quatre dessins, avec ombre et reflet qui suivent la hauteur (à juger en mouvement).
- [x] Coups de poing léger et moyen debout, minutés comme dans un jeu de combat. Le léger a un jeu de jambes de boxe (à juger en mouvement).
- [x] Mannequin d'entraînement : les coups et la boule de feu le touchent, avec arrêt sur image, étincelle, secousse et oscillation sur son ressort (à juger en mouvement).
- [x] Coups reçus : le mannequin attaque sur commande, le personnage encaisse (deux dessins, recul) ou pare (étincelle bleue, recul court) (à juger en mouvement).
- [x] Adversaire original, en garde face au personnage : il encaisse les coups.
- [x] Adversaire : parade, tenue par une case à cocher pour tester les coups parés.
- [x] Adversaire : coup encaissé en deux dessins.
- [x] Adversaire : nouvelle garde aux proportions de Moussa.
- [x] Adversaire : déplacement en lévitation, avant et arrière (un dessin par sens, animé en continu), et un premier comportement (il garde ses distances). Remplace la marche en pas chassés, trop saccadée.
- [x] Adversaire contrôlable par un second joueur, aux flèches : il se déplace en lévitation et pare.
- [x] Adversaire : dash avant et dash arrière en téléportation (deux appuis rapides vers Moussa), à la manière de Doom ; au corps à corps, il passe dans le dos de Moussa et les combattants changent de côté, toujours face à face.
- [ ] Changement de côté : le reporter dans le folio ; décider si Moussa peut aussi passer de l'autre côté (saut par-dessus).
- [x] Plus de boutons sous la scène : tout se joue au clavier.
- [x] Adversaire : enchaînement coup de poing (quatre dessins, légère avancée), coup de pied haut (trois dessins), puis coup de marteau vers le sol (trois dessins) ; il touche Moussa.
- [ ] Adversaire : la suite de son enchaînement ; dashs, coup, recul quand il encaisse ; parade et coup encaissé à refaire au nouveau modèle.
- [x] Seconde attaque spéciale : mise au point figée sur le personnage, ruée, rafale de dix coups au hasard et trois coups lourds, un effet à chaque impact, puis frappe au sol, avec décor assombri, plan de coupe sur le gros plan de Moussa et effets dessinés (remplace la rafale de coups de pied) (à juger en mouvement).
- [x] Cinématique d'entrée en six plans (temple, Moussa en pied, gros plan, puis l'adversaire en trois plans) avec transition par un pétale, puis « Face your destiny », « Round 1 », « Fight! » ; on peut la passer (à juger en mouvement).
- [x] Fin de round : il se baisse et disparaît d'un bond dans la fumée, puis « Round 2 » (à juger en mouvement).
- [x] Coup de pied en quatrième coup de l'enchaînement, après le coup fort (à juger en mouvement).
- [x] K.O. du personnage : quatre dessins, fumée à la chute, « K.O. », puis round suivant (à juger en mouvement).
- [x] Sauts avant et arrière : le saut vertical, avec un déplacement en vol et le corps incliné dans le sens du saut (à juger en mouvement).
- [x] Enchaînement seulement si le coup touche, et annulation de la récupération d'un coup par l'attaque spéciale.
- [x] Un seul atlas lié à la fois : plus de limite au nombre de poses.
- [x] Logos de marque effacés sur les baskets de la garde et de la marche.

## Essais abandonnés

- **Pose neutre de face** (`moussa_rig/`, 17 calques) : le passage de la face au profil sautait aux yeux, même avec un fondu. Toutes les poses sont maintenant dans la même vue.
- **Planches de frames générées** : le personnage change trop d'une image à l'autre, l'animation tremble.
- **Marche à plusieurs dessins clés** (branche `marche-poses`) : chaque changement de dessin se voyait comme une saccade. La marche reste sur un seul dessin animé en continu.

## À reprendre sur le personnage

- [ ] Effacer le logo des baskets sur la pose intermédiaire (`../art/hero-step.png`).
- [ ] Adoucir le pli du genou de la marche et articuler l'avant-bras.
- [ ] Articuler les bras et les jambes de la garde.
- [x] Une seule touche d'attaque, qui enchaîne le coup léger puis le moyen.
- [x] Deux dessins de transition entre le jab et le direct.
- [ ] Poing moyen : refaire le retour en corps entier, comme l'impact.
- [x] Coup fort, un uppercut, troisième de l'enchaînement.
- [x] Effet de vitesse sur les dashs : étirement, inclinaison et traînée.
- [x] Attaque spéciale : boule de feu calculée par un shader (à juger en mouvement).
- [ ] Boule de feu : éclairage du personnage pendant la charge, vraie commande (quart de cercle puis attaque).
- [ ] Accroupi : animer séparément la tête et les rubans.
- [ ] Alléger le chargement : environ 17 Mo d'atlas sont téléchargés au démarrage.
- [ ] Parade : la déclencher en reculant au moment d'un coup, quand il y aura un adversaire.
- [ ] Adversaire : refaire la parade et le coup encaissé au nouveau modèle.
- [ ] K.O. : une animation pour se relever.
- [ ] Rafale de l'attaque spéciale : le corps saute un peu d'un coup à l'autre (points d'appui différents).
- [ ] Dashs : animer les rubans, ajouter un élan et une réception, et ne plus amorcer la marche au premier des deux appuis.

## Ensuite

1. **Structure du portfolio** : écran titre, menu principal, puis les sections (projets, parcours, à propos, contact) en HTML par-dessus ou à côté de la scène. Ajouter **Zustand** à ce moment-là pour l'écran courant.
2. **Transitions entre écrans** : séquences chorégraphiées avec **GSAP**.
3. **Autres animations du personnage** : coups accroupis et sautés, relevé après le K.O., et une pose d'élan et de réception pour les dashs. Une illustration par état, toujours dans la même vue, découpée par `tools/prepare_poses.py`.
4. **Sprites et moteur de combat** : à partir de plusieurs personnages et de nombreuses frames, passer le rendu des sprites sur **PixiJS**. Le décor en shader peut rester tel quel.
5. **Adversaire** : compléter ses poses et lui donner un comportement.
6. **Mobile** : cadrage adapté, commandes tactiles, effets allégés.
7. **Son** : musique et bruitages avec **Howler.js**, démarrés après une action du visiteur.
8. **Mise en ligne** : build statique (`dist/`), déployable sur Vercel, Netlify ou GitHub Pages.

## Questions ouvertes

- Le contenu réel : projets, parcours, liens de contact.
- Français seul, ou français et anglais ?
- Le portfolio doit-il rester lisible sans jouer (accès direct aux sections) ? Recommandé pour les recruteurs pressés.
