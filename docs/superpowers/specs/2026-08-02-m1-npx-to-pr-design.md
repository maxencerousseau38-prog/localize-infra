# Spec — M1 : le chemin `npx` → PR

Date : 2026-08-02
Statut : validé pour implémentation (spec dérivée directement de la section 7 du prompt de build original — pas de session de brainstorming, conformément à la demande du human partner de suivre la roadmap telle quelle)
Portée : M1 (roadmap : semaines 2–5). Sprint 0 (`packages/eval`) est terminé et mergé sur `master`.

## 1. Objectif (roadmap, verbatim)

> `cli init` détecte le framework (Next.js, Vite/React, React Native, Rails), repère les
> chaînes en dur par AST, génère le fichier de clés, appelle l'API de traduction
> contextualisée, ouvre une PR via la GitHub App.
> *Fait quand :* sur trois dépôts publics inconnus, la commande produit une PR mergeable en
> moins de trois minutes.

## 2. Décisions d'architecture nécessaires (non explicites dans la roadmap)

La roadmap est un critère de sortie, pas une architecture. Ces décisions sont prises ici, par
moi, pour rester fidèle à l'esprit du document tout en étant implémentable :

### 2.1 Frameworks couverts par M1

Section 2 du prompt de build : *"Parsing AST : `ts-morph` (TS/JS/TSX) **puis** `tree-sitter`
pour le polyglotte"* — le mot "puis" indique explicitement une séquence, pas un livrable
simultané. Next.js, Vite/React et React Native sont tous TS/JS/TSX (ts-morph seul suffit).
Rails est Ruby/ERB — un langage complètement différent, qui nécessite tree-sitter (l'étape
"polyglotte" explicitement postérieure).

**Décision : M1 couvre Next.js, Vite/React et React Native. Rails est explicitement hors
périmètre de M1**, reporté à quand `tree-sitter` sera intégré (M2 ou plus tard, à spécifier
séparément). C'est cohérent avec le "puis" du prompt d'origine, pas une réduction de scope
improvisée.

### 2.2 "L'API de traduction contextualisée"

Section 3 du prompt de build fixe la frontière open-core : `cli`/`core`/`adapters`/`sdk-*`/
`schemas`/`eval` sont ouverts ; `context`/`agents`/`api`/`web` sont propriétaires. Le CLI doit
donc être un **client HTTP fin** qui appelle une API déployée séparément — il ne doit pas
embarquer la logique de traduction lui-même (ça romprait la frontière open-core : n'importe
qui pourrait lire le prompt-engineering propriétaire dans le code source ouvert du CLI).

**Décision :**
- `apps/api` (Hono, propriétaire) expose `POST /v1/translate` : reçoit un lot de chaînes +
  contexte (fichier, composant, glossaire — même forme que la condition B du harnais Sprint 0),
  route vers Anthropic/OpenAI, retourne les traductions.
- La logique de routage modèle et de construction de prompt réutilise le **design** validé par
  Sprint 0 (`packages/eval/src/router`, `packages/eval/src/conditions/prompts.ts`) mais est
  **réimplémentée dans `apps/api`**, pas importée depuis `packages/eval` (qui est open source).
  Une petite duplication de code est le prix correct de la frontière open-core — documenté ici
  pour que ça ne soit jamais lu comme un oubli de factorisation.
- Pour M1, `apps/api` tourne **en local** (`pnpm --filter @localize-infra/api dev`, Hono a un
  adaptateur Node standalone) — le déploiement Vercel réel est un sujet séparé (provisionnement
  d'infrastructure cloud, nécessite un compte Vercel — décision humaine explicite, pas prise
  ici). Le CLI lit l'URL de l'API depuis une variable d'environnement
  (`LOCALIZE_API_URL`, défaut `http://localhost:8787`).

### 2.3 La GitHub App

**Blocage réel, non contournable par un agent** : une GitHub App se crée via une session
navigateur authentifiée sur `github.com/settings/apps/new` (ou le flux manifest, qui exige
quand même un clic humain pour autoriser la création). Aucune commande `gh`/API ne peut créer
une GitHub App from scratch sans cette étape humaine.

**Décision :** `services/github-app` est développé et testé avec des appels Octokit mockés
jusqu'à ce point. Dès que ce point du plan est atteint, j'arrête et je demande au human partner
de créer la GitHub App (permissions minimales : `contents:write`, `pull_requests:write`) et de
fournir `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` — ce n'est pas
une pause "j'aurais pu deviner", c'est une vraie limite d'exécution en dehors d'un navigateur.

### 2.4 "Trois dépôts publics inconnus"

Ouvrir des PR non sollicitées sur de vrais projets tiers, sans le consentement de leurs
mainteneurs, est inapproprié et n'est pas quelque chose que je ferai de façon autonome — quel
que soit le critère de sortie de la roadmap.

**Décision :** le critère "3 dépôts publics inconnus, PR mergeable en moins de 3 minutes" sera
validé contre **3 dépôts fixtures créés sous le compte GitHub du human partner** (via `gh repo
create`, dépôts jetables clairement nommés, ex. `localize-infra-fixture-nextjs`), pas contre
des projets OSS tiers. Ça teste le chemin CLI → API → PR réel et de bout en bout sans jamais
solliciter un mainteneur tiers non consentant. Un test contre un vrai dépôt tiers réel resterait
possible plus tard, mais seulement avec l'accord explicite du human partner à ce moment-là.

## 3. Architecture des paquets (structure déjà prévue en §3 du prompt de build)

```
packages/core       # NOUVEAU — détecteurs de framework, extracteur AST (ts-morph),
                     #           générateur de fichier de clés, diff engine
packages/cli        # NOUVEAU — bin npx, orchestration : detect → extract → call API →
                     #           write locale files → open PR
apps/api             # NOUVEAU — Hono, POST /v1/translate (propriétaire)
services/github-app  # NOUVEAU — Octokit, ouverture de PR (propriétaire)
```

`packages/core` et `packages/cli` sont open source (licence permissive, comme `packages/eval`).
`apps/api` et `services/github-app` sont propriétaires (pas de `"license": "MIT"` dans leur
`package.json`, pas de publication npm).

## 4. Flux de bout en bout (ce que `npx @localize-infra/cli init` fait réellement)

1. Détecte le framework du répertoire courant (`packages/core`'s détecteurs, par ordre de
   spécificité : Next.js avant Vite générique avant React Native).
2. Extrait les chaînes en dur via ts-morph, avec chemin de fichier + composant + code
   environnant (même besoin de contexte que Sprint 0's condition B).
3. Génère `locales/en.json` (fichier de clés canonique, clé stable dérivée du chemin +
   contenu).
4. Appelle `POST /v1/translate` sur `apps/api` pour chaque locale cible (paramétrable,
   défaut `['de','ja','es','ar','pt-BR']` — mêmes 5 langues que Sprint 0 pour la continuité).
5. Écrit `locales/<locale>.json` pour chaque langue.
6. Ouvre une branche + PR via `services/github-app` (titre/description générés, liste des
   chaînes extraites et des locales touchées).

## 5. Critères de sortie de M1 (repris de la roadmap, opérationnalisés)

- Sur un dépôt Next.js fixture, Vite/React fixture, et React Native fixture (créés sous le
  compte du human partner) : `npx @localize-infra/cli init` produit une PR mergeable en moins
  de 3 minutes.
- L'extraction AST ne rate aucune chaîne en dur évidente et ne produit aucun faux positif sur
  du code déjà internationalisé (ex. `t('key')` calls) — testé par fixtures unitaires
  (`packages/core`), pas seulement par les 3 dépôts de bout en bout.
- Le fichier de clés généré est stable : ré-exécuter `init` sur un dépôt déjà traité ne
  duplique pas les clés, ne casse pas les traductions existantes (diff engine).

## 6. Hors périmètre de M1 (explicitement)

- Support Rails/Ruby (reporté à l'intégration tree-sitter).
- Déploiement Vercel réel de `apps/api` (reste local pour M1 ; décision de déploiement cloud
  différée).
- Test contre de vrais dépôts OSS tiers non consentants.
- `packages/sdk-react` (types générés depuis les clés) — c'est M2.
- Moteur de contexte visuel (Playwright) — c'est M3. Le contexte de condition B reste limité au
  chemin de fichier + code environnant + glossaire, comme en Sprint 0.
