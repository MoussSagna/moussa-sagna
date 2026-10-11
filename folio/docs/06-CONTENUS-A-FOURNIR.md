# Contenus et visuels à fournir

Le site n'invente aucun contenu. Tout ce qui manque est affiché « À compléter », « Visuel à fournir » ou
comme un lien indisponible. Cette liste indique quoi fournir et où le renseigner. Aucune page n'est à modifier :
tout passe par les fichiers de `src/data/`.

## Personnages — priorité 1

**Moussa est intégré** (accueil, intro, à propos). Détail des fichiers, du découpage et des limites :
`07-PERSONNAGE-MOUSSA.md`. **L'adversaire n'a pas de visuel** : l'accueil et l'intro affichent un emplacement vide.

Reste à fournir :

| À fournir | Pourquoi |
|---|---|
| Un adversaire original : portrait et personnage en pied sur fond transparent | Son emplacement est vide sur l'accueil et dans l'intro |
| Pose de face de Moussa deux fois plus grande | Pour rester nette sur les écrans haute densité |
| Feuilles de sprites des deux personnages | Indispensables avant toute animation ; les planches actuelles ne suffisent pas |

Les fichiers se déposent dans `public/assets/fighters/<personnage>/` et se déclarent dans
`src/data/fighters.ts` : `portrait` (gros plan affiché dans un cadre) et `stance` (personnage en pied détouré),
chacun avec son chemin sans slash initial et ses dimensions en pixels. Pour l'adversaire, le dossier est
`public/assets/fighters/challenger/`.

L'adversaire doit être un personnage original : les personnages d'autres éditeurs sont protégés et ne doivent
pas apparaître sur le site.

## Projets

Fichier : `src/data/projects.ts`.

| Projet | Manquant |
|---|---|
| RACINE EYEWEAR | visuel principal, rôle, année, contexte, problématique, objectifs, démarche, solutions, galerie, technologies, liens |
| BOXING CLUB DE LA PLAINE | idem |
| TOKYO UNDERGROUND | liens (site en ligne, dépôt) ; galerie à enrichir |

Les images de projet se déposent dans `public/assets/projects/` et se déclarent dans `cover` et `gallery`,
chacune avec un texte alternatif.

## Parcours

Fichier : `src/data/experience.ts`.

- Description des missions pour SACEM, SONOFSNEAKERS et Team Trail Ouzbek.
- Compétences associées à affiner pour chaque poste.
- Expérience 2017 – 2018 : entreprise, poste, missions et compétences.

## Profil

Fichier : `src/data/profile.ts`.

- `PROFILE.intro` et `PROFILE.quote` sont des propositions de rédaction, à valider ou réécrire.
- `SKILL_PANELS` : outils de design, autres langages et frameworks, outils de motion design. Les compétences
  listées aujourd'hui sont celles que le contexte du projet et le code de ce portfolio confirment.

## Contact

Fichier : `src/data/profile.ts`, objet `CONTACT`.

- `email` : adresse seule, sans `mailto:`.
- `linkedin` et `github` : URL complètes.

Tant qu'une valeur est à `null`, le bouton correspondant est désactivé.

## Autres

- Favicon (aucun pour l'instant, d'où une requête 404 sans conséquence sur `favicon.ico`).
- Image de partage pour les réseaux sociaux.
