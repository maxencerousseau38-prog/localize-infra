# Spec — Harnais d'évaluation de qualité de traduction (`packages/eval`)

Date : 2026-07-30
Statut : validé pour implémentation
Portée : Sprint 0 uniquement (5 jours). Le reste du produit (M1–M6) fera l'objet de specs séparées.

## 1. Contexte et enjeu

Le projet global est une infrastructure de localisation développeur-first (remplacement de Phrase/Lokalise/Smartling/Crowdin), régie par cinq invariants non négociables (Git = source de vérité, PR = premier livrable, pas de facturation au volume, l'agent remonte l'ambiguïté au lieu de la deviner, résidence UE).

Avant de construire quoi que ce soit d'autre, le projet a une condition d'invalidation : est-ce qu'un modèle + contexte produit une traduction jugée préférée-ou-équivalente à une référence humaine, dans au moins 3 langues sur 5 ? Si non, le produit n'a pas de raison d'exister sous cette forme.

`packages/eval` répond à cette question ET devient le composant CI permanent qui empêche toute régression silencieuse de qualité quand on change de modèle, de prompt ou de moteur de contexte.

## 2. Portée de cette session

**Construit maintenant (stages 1–4 + code du stage 5) :**
- Corpus de référence (extraction + normalisation depuis 8–10 projets OSS)
- Router modèle minimal (Anthropic + OpenAI)
- Génération des traductions en conditions A et B
- Suite de tests déterministes, branchée en CI (`pnpm test`)
- Génération des paquets de comparaison humaine en aveugle (artefact d'export)
- Code d'import des jugements + calcul du rapport et de la porte de décision

**Explicitement hors de cette session :**
- Recrutement réel des 15 évaluateurs natifs freelance (aucun accès à une plateforme de recrutement/paiement) — le format d'export/import est prêt, le recrutement reste une action humaine en dehors de Claude Code.
- Import de vrais jugements humains (dépend du point précédent) — testé avec des données synthétiques uniquement.
- Contexte visuel (capture Playwright par composant) — reporté à M3. Voir §4 pour la justification.

## 3. Écart assumé par rapport à la condition B décrite dans le prompt de build

Le prompt d'origine définit la condition B comme : « modèle + contexte complet (emplacement code, composant, capture d'écran, glossaire, contrainte de longueur, règle ICU) ».

La capture d'écran par composant dépend du moteur Playwright/CI qui est un livrable de M3 (semaines 10–14) — il n'existe pas encore. Le construire uniquement pour ce sprint serait une avance de portée non justifiée.

**Décision :** la condition B de ce sprint inclut tout sauf la capture d'écran :
- chemin du fichier source
- extrait de code environnant (quelques lignes autour de la chaîne)
- nom du composant/module (dérivé de l'AST)
- glossaire du projet source
- structure ICU détectée
- contrainte de longueur (dérivée du contexte disponible, pas d'une mesure de conteneur réelle)

Cet écart est documenté dans le rapport final. Quand M3 livre la capture visuelle, le harnais sera rejoué avec la condition B complète pour mesurer l'apport marginal du visuel — c'est un test qu'on veut de toute façon.

## 4. Modèle de données (Zod, partagé avec `packages/schemas`)

```ts
CorpusEntry {
  id: string
  sourceProject: string
  sourceLicense: string        // ex: "MIT", "Apache-2.0"
  sourceRepoUrl: string
  sourceCommit: string         // figer la provenance
  filePath: string
  surroundingCode: string
  componentName: string | null
  icuStructure: string | null  // message ICU brut si applicable
  sourceText: string           // anglais
  targetLocale: 'de' | 'ja' | 'es' | 'ar' | 'pt-BR'
  humanReference: string       // traduction communautaire native du projet OSS
}

TranslationResult {
  corpusEntryId: string
  condition: 'A' | 'B'
  targetLocale: string
  provider: 'anthropic' | 'openai'
  modelId: string
  text: string
  error: string | null         // échec d'appel modèle, ne bloque pas le run
}

DeterministicScore {
  corpusEntryId: string
  condition: 'A' | 'B'
  placeholderIntact: boolean
  icuValid: boolean
  pluralCategoriesCorrect: boolean | null   // null si pas de pluriel dans la chaîne
  lengthOverflow: boolean
  glossaryHits: { term: string; respected: boolean }[]
}

ComparisonTask {
  id: string
  corpusEntryId: string
  targetLocale: string
  pairType: 'A_vs_C' | 'B_vs_C'
  left: string                 // texte, provenance masquée
  right: string
  leftIsCondition: 'A' | 'B' | 'C'   // clé de dépouillement, jamais envoyée à l'évaluateur
  rightIsCondition: 'A' | 'B' | 'C'
}

ComparisonJudgment {
  taskId: string
  evaluatorId: string
  preferred: 'left' | 'right' | 'equivalent'
  errorTags: ('terminologie' | 'registre' | 'grammaire' | 'troncature' | 'placeholder_corrompu' | 'contresens')[]
  notes: string | null
}
```

## 5. Corpus de référence

Sélection : 8–10 projets OSS avec code sous licence permissive (MIT/Apache-2.0) et traductions communautaires natives hébergées sur Weblate/Crowdin/GitLocalize, choisis pour couvrir les 5 langues cibles avec une bonne couverture de chaînes UI réalistes (pas de la documentation brute). Candidats pressentis : Home Assistant, Immich, Joplin, Standard Notes, Grafana, Discourse, Documenso, Cal.com — liste finale arrêtée pendant l'implémentation en fonction de la couverture réelle par langue, documentée avec licence et attribution dans `corpus/README.md`.

300 à 500 chaînes au total, échantillonnées pour la diversité : longueur courte/longue, présence de placeholders, présence de pluriels ICU, chaînes avec contexte de composant clair vs ambigu.

Le corpus est extrait une fois, normalisé, et **committé dans le dépôt** (`packages/eval/corpus/data/*.json`) — pas de dépendance à la disponibilité des dépôts externes au moment du CI.

## 6. Pipeline (scripts indépendants, chaînables)

1. **`corpus:build`** — clone/fetch les projets sources, extrait via adaptateurs de format existants (`packages/adapters` : json, po, yaml, arb, resx selon le projet), normalise en `CorpusEntry[]`, écrit les fixtures JSON.
2. **`translate:run`** — pour chaque `(entry, targetLocale)`, appelle le router modèle minimal deux fois : condition A (chaîne source seule) et condition B (chaîne + contexte décrit en §4). Retry avec backoff sur échec réseau ; un échec sur une entrée ne bloque pas le run, il est loggé et remonte comme `error` dans `TranslationResult`.
3. **`test`** (Vitest, gate CI) — checkers déterministes purs et testés unitairement :
   - Intégrité des placeholders/interpolations (`{name}`, `%s`, `{{count}}`, ICU `{count, plural, ...}`)
   - Validité du parsing ICU après traduction
   - Catégories de pluriel correctes par locale (ar : 6 catégories, ja : 1, de/es/pt-BR : 2)
   - Dépassement de longueur par rapport à la contrainte disponible
   - Cohérence de glossaire
   - Seuil de sortie : intégrité placeholders/ICU ≥ 99,5 % sur l'ensemble du corpus × condition B
4. **`human-eval:generate`** — construit les `ComparisonTask[]` en aveugle (ordre gauche/droite randomisé, provenance masquée dans la clé de dépouillement séparée), exporte en JSON + CSV avec les instructions de tâche et la taxonomie d'erreurs imposée, prêt à être remis à des évaluateurs externes.
5. **`human-eval:import` + `report:build`** — ingère les `ComparisonJudgment[]` remplis, calcule par langue le taux préféré/équivalent/rejeté pour A vs C et B vs C, écrit un rapport markdown versionné par langue dans `packages/eval/reports/<locale>.md`, calcule la porte de décision globale (B préféré-ou-équivalent à C dans ≥ 3 langues sur 5).

## 7. Router modèle minimal

Volontairement mince — pas le routeur produit multi-modèle des milestones futurs. Une interface `translate(prompt, { provider, modelId }): Promise<string>` avec deux implémentations (Anthropic, OpenAI), sélection explicite par appelant (pas de logique de routage intelligent ici). Clés lues depuis l'environnement (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).

## 8. Tests et CI

- Vitest pour chaque checker déterministe, avec fixtures manuelles couvrant les cas limites (pluriel arabe à 6 formes, japonais à 1 forme, placeholder imbriqué dans un ICU select, glossaire avec terme absent).
- Un test de non-régression qui rejoue le corpus complet et vérifie le seuil ≥ 99,5 % — ce test tourne en CI et casse le build si une régression apparaît après un changement de modèle/prompt.
- L'appel modèle réel (stage 2) n'est pas dans le chemin critique de CI à chaque commit (coût, latence, non-déterminisme) — il tourne à la demande ou sur un cron, ses sorties sont committées comme fixtures que le stage 3 teste.

## 9. Scaffolding de dépôt (fait en même temps)

- Racine monorepo : `pnpm-workspace.yaml`, Turborepo, Biome (lint+format unique), TypeScript strict partagé.
- `CLAUDE.md` racine avec les cinq invariants et les garde-fous permanents de la section 8/9 du prompt de build d'origine.
- `packages/schemas` : uniquement les schémas Zod nécessaires à `eval` pour l'instant (pas la surface complète du produit — ça viendra avec M1).

## 10. Licence et visibilité du package

`packages/eval` est publié en open source dès cette session (licence permissive, alignée sur `cli`/`core`/`adapters`). Raison : le garde-fou permanent #7 du produit engage à publier les benchmarks de qualité y compris les langues où on perd — un harnais fermé contredirait cet engagement d'auto-critique publique.

## 11. Critères de sortie de cette session

- `pnpm --filter eval test` passe et applique le seuil ≥ 99,5 % sur placeholders/ICU pour la condition B.
- Le corpus (300–500 entrées, 8–10 projets, 5 langues) est committé avec licences documentées.
- `human-eval:generate` produit un export JSON/CSV valide et lisible, avec instructions et taxonomie d'erreurs, testable de bout en bout avec des jugements synthétiques.
- `report:build` calcule correctement la porte de décision (≥ 3/5 langues) sur des données synthétiques.
- La porte humaine réelle (≥ 3/5 langues, B préféré-ou-équivalent à C) reste **non tranchée** tant que le recrutement des évaluateurs n'a pas eu lieu — ce n'est pas un échec de cette session, c'est une dépendance externe explicite.

## 12. Risques et questions ouvertes

- Couverture inégale des 5 langues selon les projets OSS choisis (l'arabe et le japonais sont statistiquement moins représentés dans les traductions communautaires que l'allemand/espagnol/portugais) — à vérifier tôt dans `corpus:build`, quitte à élargir la liste de projets sources si un quota par langue n'est pas atteint.
- Le glossaire par projet OSS n'est pas toujours documenté explicitement — dérivé heuristiquement (termes récurrents en majuscule/code) à défaut d'un glossaire officiel ; qualité à valider manuellement sur un échantillon.
- Le seuil « préféré-ou-équivalent » dépend entièrement de la qualité des 15 évaluateurs recrutés plus tard — hors du contrôle de ce sprint.
