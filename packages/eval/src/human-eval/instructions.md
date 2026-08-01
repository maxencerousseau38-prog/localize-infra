# Instructions évaluateur — comparaison de traductions en aveugle

Vous allez comparer des paires de traductions pour une même chaîne source anglaise,
sans savoir laquelle vient d'un modèle et laquelle vient d'une traduction humaine
de référence. Ne cherchez pas à deviner — jugez uniquement la qualité.

## Pour chaque ligne du fichier `tasks.csv`

1. Lisez `left` et `right`.
2. Choisissez : `left` est meilleure, `right` est meilleure, ou `equivalent`.
3. Si l'une des deux comporte un défaut, indiquez au moins une étiquette parmi :
   `terminologie`, `registre`, `grammaire`, `troncature`, `placeholder_corrompu`, `contresens`.
4. Notes libres optionnelles.

## Rendu attendu

Un fichier `judgments.json`, un objet par tâche :

```json
{
  "taskId": "excalidraw-labels.paste-de-A_vs_C",
  "evaluatorId": "votre-identifiant",
  "preferred": "left",
  "errorTags": ["registre"],
  "notes": "Ton trop formel pour un bouton"
}
```

`taskId` doit correspondre exactement au champ `id` de `tasks.csv`/`tasks.json`.
`evaluatorId` est libre mais doit rester identique sur tous vos jugements.
