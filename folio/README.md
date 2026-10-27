# Tokyo Underground — le portfolio

Le site de Moussa Sagna qui sera mis en ligne : un portfolio présenté comme un jeu de combat 2D. Les pages sont en React ; l'arène, sur `/entrainement`, affiche le jeu de `../game/` (le même que le lab) : Moussa y affronte Shigaraki.

Ce dossier est l'un des deux projets du dépôt. Le jeu de l'arène vit dans [`../game/`](../game/README.md) et se met au point dans [`../lab/`](../lab/README.md) ; il arrive ici tel quel (voir « Le jeu de l'arène »).

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
| `/entrainement` | Écran de chargement, cinématique d’entrée, puis le combat contre Shigaraki, jouable au clavier, en plein écran si on veut |
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
| Drive rush | pendant un coup qui touche ou est paré, deux appuis rapides vers l'avant (2 blocs de drive) |
| Boule de feu | L |
| Attaque finale | I, même en plein combo |

L'arène affiche le jeu de [`../game/`](../game/README.md), le même que le lab : écran de chargement, cinématique, combat contre Shigaraki, barres, K.O. et rounds. Elle se joue au clavier (pas de commandes tactiles). Échap passe l'intro ; F, ou le bouton en bas de l'écran de jeu, met l'arène en plein écran (Échap ou F pour en sortir).

## Structure

- `src/main.tsx` — point d'entrée React (routeur, polices, styles).
- `src/App.tsx` — table des routes.
- `src/pages/` — une page par fichier.
- `src/components/` — composants partagés ; `GameArena.tsx` est le seul fichier qui crée le moteur du jeu, `ArenaLoading.tsx` son écran de chargement.
- `src/data/` — tous les contenus (projets, parcours, profil, contact, combattants, navigation, textes de l'arène).
- `src/styles/` — `main.css` (jetons et base), `components.css`, `pages.css`.
- `public/assets/backgrounds/` — `stage.webp`, le décor, en fond de plusieurs pages.
- `public/assets/fighters/` — visuels de Moussa et de Shigaraki utilisés par les pages (portraits, personnages en pied).
- `../game/` — le jeu de l'arène (moteur et images), partagé avec le lab ; ses images sont servies avec celles de `public/` (voir `vite.config.ts`).
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

## Le jeu de l'arène

Il n'y a plus rien à reporter du lab : l'arène affiche le jeu de `../game/`, mis au point dans le lab. Après un changement du jeu, lancer `npm run test` et `npm run build` ici, puis regarder l'arène. Jusqu'au 27 octobre 2026, l'arène était une réécriture en Phaser, reportée à la main ; elle a été retirée.

## Ce qui n'est pas dans le dépôt

Deux dossiers restent en local à la racine de la copie de travail, ignorés par git parce que trop lourds : `references/` (planches d'origine d'où sont découpés les portraits) et `Tokyo_Underground_Documentation/` (images des plans d'animation). Le site se construit et tourne sans eux.

## Mise en ligne

Le site utilise `BrowserRouter` : l'hébergeur doit renvoyer `index.html` pour toute adresse inconnue, sinon recharger une page interne donne une erreur 404.
