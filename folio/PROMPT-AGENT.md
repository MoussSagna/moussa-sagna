# Prompt pour l'agent — Tokyo Underground

Tu es mon Lead Developer spécialisé en TypeScript, Phaser et architecture de jeux 2D. Tu travailles sur **Tokyo Underground**, un portfolio créatif inspiré de l'esthétique des jeux de combat 2D d'Arc System Works.

## Avant de coder

1. Lis entièrement `README.md` et tous les fichiers Markdown de `docs/`.
2. Inspecte le dépôt actuel : `package.json`, scripts, dépendances, configuration Vite/TypeScript, structure des dossiers et assets disponibles.
3. Identifie les assets de décor et les références déjà présents. Ne suppose jamais un chemin de fichier sans vérifier son existence.
4. Fais un bref état des lieux et signale tout conflit avec l'architecture existante.
5. Préserve le travail existant : ne réinitialise pas le dépôt et ne remplace pas de fichiers sans raison.

## Objectif de cette tâche : étape 1 uniquement

Construis le socle technique **Vite + TypeScript + Phaser 3 avec rendu WebGL** et une scène d'arène minimale pour Tokyo Underground.

Le projet doit être simple, propre, vérifiable et prêt à accueillir des fonctionnalités futures sans les développer maintenant.

### Travail attendu

- Vérifier ou mettre en place la configuration Vite et TypeScript en conservant le gestionnaire de paquets et les conventions du dépôt.
- Installer Phaser uniquement si nécessaire.
- Créer une configuration Phaser isolée, par exemple `src/game/config.ts`.
- Créer une scène minimale `src/game/scenes/ArenaScene.ts`.
- Afficher une arène simple avec un fond existant s'il est disponible, sinon un fond temporaire lisible, et une ligne de sol/horizon.
- Utiliser une résolution logique de référence de `1280 × 720`.
- Configurer le scale pour s'adapter à la fenêtre sans déformer le ratio.
- Garder le code de configuration, la scène et le point d'entrée clairement séparés.
- Ajouter uniquement les styles et le code nécessaires au fonctionnement.
- Mettre à jour les scripts utiles si besoin, sans supprimer les scripts existants sans justification.
- Documenter les commandes de lancement et les vérifications réalisées.

### Architecture

Phaser doit gérer le canvas et la scène de jeu. React pourra servir plus tard à l'interface du portfolio, mais **n'ajoute pas React maintenant si le dépôt et le périmètre de cette étape ne l'exigent pas**. Ne construis pas l'interface finale dans cette tâche.

### Hors périmètre strict

Ne développe PAS :
- animations idle/guard, marche, dash, saut ou entrée du personnage ;
- intégration animée du sprite de Moussa ;
- contrôles clavier ou manette ;
- attaques, hitboxes, collisions de combat, dégâts, combos ou barres de vie ;
- IA de l'adversaire ;
- effets spéciaux, audio ou cinématiques ;
- pages du portfolio ou écran de sélection final.

La roadmap décrit ces idées pour les étapes suivantes, mais ne t'autorise pas à les commencer.

## Critères d'acceptation

- Le serveur Vite démarre.
- Phaser s'initialise sans erreur.
- La scène d'arène est visible.
- Le rendu WebGL est activé sur un navigateur compatible.
- Le canvas s'adapte au redimensionnement de la fenêtre.
- Le ratio de la scène reste correct.
- Les assets chargés existent réellement.
- Les commandes de build, lint et test disponibles sont exécutées si elles existent.
- Aucun système d'animation ou de combat n'a été ajouté.

## Méthode de travail

1. Inspecter.
2. Présenter brièvement les changements prévus.
3. Implémenter uniquement l'étape 1.
4. Lancer les vérifications réellement disponibles.
5. Corriger les erreurs introduites.
6. Rédiger le rapport final avec les fichiers modifiés, les commandes exécutées, les résultats, les limites et les instructions de vérification.

Ne prétends pas qu'un test a réussi s'il n'a pas été exécuté. Si un point est bloqué par l'absence d'asset ou par la configuration du dépôt, explique-le et propose le plus petit contournement raisonnable.

**Livrable final : une scène Phaser minimale et fonctionnelle, pas un jeu de combat et pas encore le portfolio complet.**
