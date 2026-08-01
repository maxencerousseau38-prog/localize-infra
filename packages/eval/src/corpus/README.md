# Corpus de référence

Chaînes UI et traductions communautaires natives extraites de projets OSS sous
licence permissive, pour évaluer la qualité de traduction du harnais sans
payer de référence humaine.

## Sources (voir `sources.ts` pour les commits exacts)

| Projet | Licence | Format | Locales couvertes |
|---|---|---|---|
| [excalidraw](https://github.com/excalidraw/excalidraw) | MIT | JSON (`packages/excalidraw/locales/*.json`) | de, ja, es, ar, pt-BR |
| [gitea](https://github.com/go-gitea/gitea) | MIT | JSON (`options/locale/locale_*.json`) | de, ja, es, pt-BR |
| [zulip](https://github.com/zulip/zulip) | Apache-2.0 | gettext `.po` (`locale/*/LC_MESSAGES/django.po`) | de, ja, es, ar |
| [syncthing](https://github.com/syncthing/syncthing) | MPL-2.0 | JSON (`gui/default/assets/lang/lang-*.json`) | de, ja, es, ar, pt-BR |
| [wekan](https://github.com/wekan/wekan) | MIT | JSON (`imports/i18n/data/*.i18n.json`) | de, ja, es, ar, pt-BR |

`syncthing` et `wekan` ont été ajoutés (Task 12) pour rééquilibrer `ar` et `pt-BR`, qui n'avaient
que 2 sources contributrices chacune (contre 3 pour `de`/`ja`/`es`) avec les seules 3 sources
pilotes ci-dessus. Les deux nouvelles sources couvrent les 5 locales cibles, y compris `ar` et
`pt-BR` — vérifié via `gh api .../contents/<dossier-locale>` avant ajout, pas supposé depuis la
réputation du projet.

Chaque `CorpusEntry` conserve `sourceRepoUrl` et `sourceCommit` pour l'attribution et la reproductibilité.

## Régénérer le corpus

```bash
pnpm --filter @localize-infra/eval run corpus:build
```

Écrit `data/entries.json` et `data/glossary.json`. Les deux fichiers sont committés — le CI ne dépend jamais d'un accès réseau à ces dépôts externes.

L'extraction brute des 5 sources produit environ 35 900 entrées ; `build.ts` en tire un échantillon stratifié d'environ 400 (`TARGET_CORPUS_SIZE`), réparti aussi équitablement que possible entre chaque combinaison (projet, locale) présente dans les données brutes, pour respecter la cible de 300-500 entrées de la spec §5. Le glossaire (`glossary.json`), lui, reste dérivé du corpus brut complet — pas de l'échantillon — car `deriveGlossary` s'appuie sur un seuil d'occurrences (`MIN_OCCURRENCES`) qui est plus fiable sur davantage de données.

## Lancer les traductions (`translate:run`)

```bash
pnpm --filter @localize-infra/eval run translate:run
```

Lit `data/entries.json` et `data/glossary.json`, appelle les providers de traduction pour chaque
`(entrée, condition A|B)`, et écrit/checkpoint `data/translations.json` (reprise automatique en
cas d'interruption — voir les commentaires de `conditions/translate.ts`).

Variables d'environnement lues par le routeur et le script de traduction :

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Clé API Anthropic, requise par `getProvider('anthropic')`. |
| `OPENAI_API_KEY` | Clé API OpenAI, requise par `getProvider('openai')`. |
| `EVAL_FORCE_PROVIDER` | `anthropic` ou `openai` : force ce provider pour **tous** les appels, en court-circuitant `pickProvider`. Non défini par défaut. |
| `EVAL_ANTHROPIC_MODEL` / `EVAL_OPENAI_MODEL` | Surchargent le `modelId` par défaut (`claude-sonnet-5` / `gpt-4o`). |

### Note sur le run Sprint 0

Le run committé dans `data/translations.json` a été produit avec **Anthropic uniquement**
(`claude-sonnet-5`, via `EVAL_FORCE_PROVIDER=anthropic`), parce qu'un accès OpenAI n'était pas
disponible dans cette session d'environnement. Ce n'est pas une limitation du routeur : `pickProvider`
reste dual-provider (répartition 50/50 par hash du seed `${corpusEntryId}-${condition}`) et c'est
ce comportement par défaut qui s'applique dès que `EVAL_FORCE_PROVIDER` n'est pas défini.

## Simplifications assumées (Sprint 0)

- Les entrées gettext avec `msgid_plural` sont ignorées (voir `adapters/gettext-locale.ts`) : la reconstruction ICU à partir de l'index `msgstr[n]` + l'expression `Plural-Forms` par locale est hors périmètre. Le checker de catégories de pluriel (`deterministic/plurals.ts`) est testé avec des fixtures ICU manuelles, pas avec ce corpus.
- `maxLength` est une heuristique (1,4 × la longueur de la chaîne source), pas une mesure de conteneur réelle — voir spec §3.
- Le glossaire est dérivé automatiquement à partir d'une liste de termes techniques/marque candidats, pas d'un glossaire officiel des projets sources.
