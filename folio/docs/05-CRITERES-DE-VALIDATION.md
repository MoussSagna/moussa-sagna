# Critères de validation — Étape 1

L'étape 1 est considérée comme terminée uniquement lorsque les points applicables ci-dessous ont été vérifiés.

## Installation et démarrage

- [ ] Les dépendances s'installent avec le gestionnaire déjà utilisé par le dépôt.
- [ ] Le serveur de développement Vite démarre sans erreur bloquante.
- [ ] Le projet compile avec TypeScript.
- [ ] Les scripts et commandes utiles sont documentés.

## Phaser et WebGL

- [ ] Phaser est initialisé une seule fois.
- [ ] Le rendu WebGL est utilisé dans un navigateur compatible.
- [ ] Une scène `ArenaScene` est affichée.
- [ ] La résolution logique de référence est 1280 × 720.
- [ ] Le fond ou décor est chargé depuis un asset réellement existant, ou remplacé par un fond temporaire clairement identifié.
- [ ] Le sol ou l'horizon permet de comprendre la profondeur de l'arène.
- [ ] Aucun personnage animé ni système de combat n'est présent.

## Redimensionnement

- [ ] Le canvas reste visible lors du redimensionnement de la fenêtre.
- [ ] Le ratio de la scène n'est pas déformé.
- [ ] Aucun débordement majeur ou canvas blanc/noir inattendu n'apparaît.
- [ ] La console ne contient pas d'erreur répétée liée au redimensionnement.

## Qualité du code

- [ ] Les types TypeScript sont correctement définis.
- [ ] Les assets sont référencés par des chemins vérifiés.
- [ ] Aucun fichier sans rapport avec l'étape n'a été modifié.
- [ ] Les erreurs et limites connues sont consignées.
- [ ] Les commandes de build, lint et test disponibles ont été exécutées, et leurs résultats sont rapportés honnêtement.

## Rapport final attendu de l'agent

Le rapport doit contenir :
1. le résumé des changements ;
2. les fichiers créés ou modifiés ;
3. les commandes exécutées et leurs résultats ;
4. les étapes manuelles pour ouvrir et vérifier l'arène ;
5. les problèmes connus ou les éléments bloquants ;
6. une confirmation explicite que les animations et le combat n'ont pas été développés.
