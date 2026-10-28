---
name: deep
description: Exécute la tâche qui suit /deep en mode « depth » (méthode de Felix Rieseberg, Anthropic) - pousser le modèle à utiliser les outils, techniques, médias et connaissances des meilleurs professionnels du domaine, au lieu d'un simple « agis comme un expert ».
---

# /deep

La tâche à accomplir est le texte qui suit `/deep`.

## Principe

« Act like an expert » change le vocabulaire de Claude, pas ses méthodes. Le correctif est la **profondeur** : demander les instruments qu'utilisent les experts, les données brutes, et des objectifs qui paraissent déraisonnables.

## Consigne à appliquer

> Depth: Sometimes, you just want a task executed really well. Being ambitious in depth means pushing the model to use the tools, techniques, media, and knowledge employed by the best professionals in the field — and to keep pushing until even those people might learn something new from your work.

## Méthode

1. **Identifie les meilleurs professionnels** du domaine de la tâche et ce qu'ils utilisent réellement : outils, techniques, formats, sources, médias.
2. **Utilise ces instruments**, pas une imitation de leur style. Va chercher les données brutes (code, fichiers, sources primaires, web) plutôt que de répondre de mémoire.
3. **Vise un objectif qui sonne déraisonnable** : le niveau d'un travail que ces experts jugeraient eux-mêmes remarquable.
4. **Continue de pousser** après une première version correcte : cherche ce qui manque, ce qui est fragile, ce qu'un expert contesterait, et améliore jusqu'à ce que même eux puissent y apprendre quelque chose.
5. **Livre le résultat**, pas un plan : conclusion ou production d'abord, puis le détail utile. Distingue ce qui est vérifié de ce qui est supposé.

Réponds en français sauf demande contraire.
