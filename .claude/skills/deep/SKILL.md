---
name: deep
description: Exécute la tâche qui suit /deep en mode « depth » (méthode de Felix Rieseberg, Anthropic) - instruments des meilleurs du métier, données brutes, objectif qui semble déraisonnable, puis réécriture du prompt avant exécution. Remplace « agis comme un expert ».
---

# /deep

La tâche est le texte qui suit `/deep`.

## Pourquoi

Quand on demande à un modèle d'agir comme un professionnel, il change de vocabulaire sans changer de méthodes. Le correctif est la profondeur : utiliser les mêmes instruments que les meilleurs du domaine, partir des données brutes, viser un objectif qui paraît déraisonnable.

## Principes (Felix Rieseberg)

1. **Insist on the same instruments used by the best in the industry.** Si le réflexe est un tableau markdown, exiger bases de données, modèles statistiques, ou l'équivalent du métier. Pas besoin de connaître soi-même ces outils : Claude les connaît.
2. **Give Claude the raw data.** Challenge what you know : beaucoup de croyances sont des approximations. Donner l'accès à l'information et aux données brutes, et vérifier les hypothèses de façon adverse (ex. « on croit que le churn est un problème d'onboarding : essaie de le reproduire à partir des données brutes »).
3. **Pick a goal that sounds unreasonable.** Des objectifs précis et difficiles donnent de meilleurs résultats que « fais de ton mieux » (Locke et Latham, 35 ans de recherche). Site en 5 s au lieu de 10 ? Viser 200 ms. Si ça semble impossible, répéter que c'est tout à fait faisable et qu'il suffit de continuer.
4. **Depth.** Pousser jusqu'à ce que même les meilleurs professionnels puissent apprendre quelque chose du travail.

## Méthode

Avant d'exécuter, applique ce prompt à la tâche :

> I want a deeper version of this task, not a bigger one. Before rewriting it: (1) say what a top professional in this field would do here that I'm not asking for; (2) name the rawest material they would start from instead of what has already been digested for me; (3) name the specific methods and tools they would use; (4) say what, other than you or me, would show the result is right. Then rewrite my prompt to ask for exactly that.

1. Réponds brièvement aux points (1) à (4) pour la tâche donnée, puis écris la version réécrite de la tâche (courte, visible pour l'utilisateur).
2. **Exécute ensuite cette version réécrite**, sans attendre : va chercher les données brutes (code, fichiers, sources primaires, web), utilise les outils identifiés, fixe l'objectif ambitieux.
3. Valide le résultat avec le critère externe du point (4) (test, mesure, source, calcul reproductible), pas avec ton seul avis.
4. Continue de pousser après une première version correcte. Livre le résultat, conclusion d'abord, en distinguant le vérifié du supposé.

Réponds en français sauf demande contraire.
