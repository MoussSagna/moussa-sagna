# Tokyo Underground — le portfolio Phaser

Le site de Moussa Sagna qui sera mis en ligne : un portfolio présenté comme un jeu de combat 2D. Les pages sont en React ; l'arène, sur `/entrainement`, est une scène Phaser où Moussa se tient en garde, marche, dashe, s'accroupit, pare, saute (sur place, en avant ou en arrière) et enchaîne coups de poing et coup de pied.

Ce dossier est l'un des deux projets du dépôt. Le décor et les animations du personnage sont mis au point dans [`../lab/`](../lab/README.md), puis reportés ici (voir « Reporter une nouveauté du lab »).

## Lancer le portfolio

Prérequis : Node.js 20 ou plus récent, et npm. Toutes les commandes se lancent depuis `folio/`, jamais depuis la racine du dépôt.

```bash
cd folio
npm install        # installe les dépendances
npm run dev        # serveur de développement Vite (http://localhost:5173 par défaut)
npm run typecheck  # vérification TypeScript stricte
npm run test       # tests unitaires (Vitest)
npm run build      # typecheck + build de production dans dist/
npm run preview    # sert le build de production
```

Il n'y a pas de script de lint.

## Pages

| Adresse | Page |
|---|---|
| `/` | Intro à la première visite, puis redirection vers l'accueil |
| `/intro` | Intro « Moussa VS », face à un emplacement d'adversaire encore vide ; toujours rejouable |
| `/accueil` | Accueil / mode arcade |
| `/projets` | Sélection des projets |
| `/projets/:slug` | Étude de cas d'un projet |
| `/a-propos` | À propos |
| `/parcours` | Expérience |
| `/entrainement` | Cinématique d’entrée, puis arène Phaser jouable au clavier, en plein écran si on veut |
| `/contact` | Contact |
| toute autre adresse | Page de secours |

Dans l'arène :

| Action | Clavier |
|---|---|
| Marcher | maintenir ← → ou Q D |
| Dasher | deux appuis rapides sur la même direction |
| S'accroupir | maintenir ↓ ou S |
| Parer, debout ou accroupi | maintenir Espace |
| Sauter | ↑ ou Z ; avec ← ou → maintenu, saut arrière ou avant |
| Attaquer | J, puis J à nouveau pour enchaîner le coup moyen, le coup fort, puis le coup de pied |

L'arène n'a plus de boutons de commande : elle se joue au clavier. Échap passe l'intro ; F, ou le bouton dans le coin de l'écran de jeu, met l'arène en plein écran (Échap ou F pour en sortir).

## Structure

- `src/main.tsx` — point d'entrée React (routeur, polices, styles).
- `src/App.tsx` — table des routes.
- `src/pages/` — une page par fichier.
- `src/components/` — composants partagés ; `ArenaCanvas.tsx` est le seul pont vers Phaser.
- `src/data/` — tous les contenus (projets, parcours, profil, contact, combattants, navigation).
- `src/game/` — moteur de jeu : configuration Phaser et `ArenaScene`.
- `src/game/stage/` — décor animé de l'arène : shader, caméra et météo.
- `src/game/hero/` — Moussa jouable : poses découpées en calques, rig, état du personnage, chargement des atlas.
- `src/game/input.ts` — clavier de l'arène.
- `src/styles/` — `main.css` (jetons et base), `components.css`, `pages.css`.
- `public/assets/backgrounds/` — `stage.webp` (décor) et `depth.png` (carte lue par le shader), repris de `lab/`. Ne pas recompresser ni redimensionner la carte.
- `public/assets/fighters/moussa/` — visuels de Moussa utilisés par les pages. L'adversaire n'a pas encore de visuel.
- `public/assets/fighters/moussa/poses/` — atlas des vingt poses de Moussa dans l'arène, générés dans `lab/` (environ 17 Mo).
- `tools/anim-plan-01/` — générateur des 24 images du bandeau rouge (Plan 01). Le site ne s'en sert pas.

## Documentation

- `docs/01-CONTEXTE-PROJET.md` — vision, objectifs et périmètre.
- `docs/02-DIRECTION-ARTISTIQUE.md` — références visuelles et règles d'interface du site.
- `docs/03-ARCHITECTURE-TECHNIQUE.md` — architecture : la cible d'origine, puis l'architecture réelle, l'arène et le personnage.
- `docs/04-ROADMAP-ET-PERIMETRE.md` — phases prévues.
- `docs/05-CRITERES-DE-VALIDATION.md` — critères d'acceptation du premier sprint.
- `docs/06-CONTENUS-A-FOURNIR.md` — contenus et visuels manquants, et où les renseigner.
- `docs/07-PERSONNAGE-MOUSSA.md` — assets de Moussa, découpage, limites.
- `PROMPT-AGENT.md` — prompt du premier sprint, terminé. Gardé pour mémoire : les consignes à jour sont dans `CLAUDE.md`.

La direction artistique commune aux deux projets est dans [`../docs/DIRECTION_ARTISTIQUE.md`](../docs/DIRECTION_ARTISTIQUE.md).

## Modifier les contenus

Tout se modifie dans `src/data/`, sans toucher aux pages. Un champ à `null` ou une liste vide s'affiche « À compléter » sur le site. La liste de ce qui reste à fournir est dans `docs/06-CONTENUS-A-FOURNIR.md`.

## Reporter une nouveauté du lab

Les deux moteurs sont différents : rien ne se copie tout seul. Pour une nouvelle pose ou un nouveau réglage validé dans `lab/` :

1. Copier les atlas concernés de `../lab/public/assets/hero/` vers `public/assets/fighters/moussa/poses/`.
2. Recopier `../lab/src/game/hero/poseData.ts` et `poseRig.ts` dans `src/game/hero/` (en gardant la première ligne de `poseRig.ts`, qui indique d'où il vient).
3. Reporter à la main ce qui a changé dans `../lab/src/game/hero/HeroLayer.ts` : l'état et ses réglages dans `heroState.ts`, l'échelle des poses dans `HeroRig.ts`, le dessin dans `scenes/ArenaScene.ts`. Une nouvelle action s'ajoute aussi à `ACTION_POSES` (ses images), à `input.ts` (sa touche) et à `controls.ts` (son bouton).
4. Lancer le site, regarder l'arène, et noter dans le message de commit le commit du lab qui a été repris.

Dernier état repris : `lab/` au commit `f8663d1` (fusion du 26 octobre) pour Moussa : le nouveau petit coup, un jab de boxeur en six dessins (`jab1` à `jab6`, repris du commit `4b5ba1b`), avec une récupération qui peut avoir plusieurs dessins. Les autres nouveautés de cette fusion ne sont pas reprises : la caméra qui suit les combattants, les sauts plus hauts pour passer par-dessus l'adversaire et la taille réduite des personnages (faite pour les barres de vie), le drive rush, le compteur de combo, l'attaque finale en combo, le K.O. spectaculaire et la victoire de fin de round supposent un adversaire, des barres ou l'attaque spéciale au sol, absents de l'arène. Avant cela : `8456faf` (sauts avant et arrière, sans l’inclinaison du corps ; coup de pied en quatrième coup de l’enchaînement). Pas encore repris : la boule de feu, l’attaque spéciale au sol, l’effet de vitesse des dashs, les impacts, le mannequin, les coups reçus, l’adversaire en combat (lévitation, téléportations, changement de côté, enchaînement, coup spécial, attaque ultime), les barres, la sortie de fin de round et le K.O. Tout cela demande du travail de rendu dans Phaser.

## Ce qui n'est pas dans le dépôt

Deux dossiers restent en local à la racine de la copie de travail, ignorés par git parce que trop lourds : `references/` (planches d'origine d'où sont découpés les portraits) et `Tokyo_Underground_Documentation/` (images des plans d'animation). Le site se construit et tourne sans eux.

## Mise en ligne

Le site utilise `BrowserRouter` : l'hébergeur doit renvoyer `index.html` pour toute adresse inconnue, sinon recharger une page interne donne une erreur 404.
