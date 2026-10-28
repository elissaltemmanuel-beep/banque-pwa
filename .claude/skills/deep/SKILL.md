---
name: deep
description: Répond en profondeur à la question qui suit /deep. Au lieu d'un rôle « agis comme un expert », donne le contexte réel (qui, pourquoi, enjeu) et exige un raisonnement détaillé, des alternatives, des risques et une recommandation tranchée.
---

# /deep

Traite la demande de l'utilisateur (le texte après `/deep`) en mode approfondi.

## Principe

Ne joue pas un personnage (« agis comme un expert en… »). Un rôle ne donne aucune information. Ce qui améliore la réponse, c'est le contexte et l'exigence : à qui sert la réponse, pour faire quoi, avec quelles contraintes, et à quoi ressemble une très bonne réponse.

## Méthode

1. **Reformule l'objectif réel** en une phrase : ce que l'utilisateur cherche à obtenir, pas seulement ce qu'il a écrit. Si une hypothèse change fortement la réponse, énonce-la ou pose une seule question.
2. **Rassemble les faits** avant de conclure : lis le code, les fichiers ou les sources pertinents, ou cherche sur le web quand l'information peut être récente. Ne réponds pas de mémoire sur ce qui est vérifiable.
3. **Explore au moins deux approches** sérieuses, avec leurs compromis concrets (coût, risque, effort, réversibilité). Écarte explicitement celles que tu rejettes et dis pourquoi.
4. **Cherche ce qui peut casser** : cas limites, hypothèses fragiles, effets de bord, ce qu'un relecteur sceptique objecterait. Corrige ta réponse en conséquence.
5. **Conclus avec une recommandation nette**, pas un panorama. Indique ton niveau de certitude et ce qui le ferait changer.

## Format de la réponse

- Commence par la conclusion ou la recommandation.
- Puis le raisonnement : faits établis, alternatives comparées, risques.
- Distingue ce qui est vérifié de ce qui est supposé.
- Pas de remplissage, pas de rappel de la question, pas de résumé final redondant.
- Réponds en français sauf demande contraire.
