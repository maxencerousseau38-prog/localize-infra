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

Chaque `CorpusEntry` conserve `sourceRepoUrl` et `sourceCommit` pour l'attribution et la reproductibilité.

## Régénérer le corpus

```bash
pnpm --filter @localize-infra/eval run corpus:build
```

Écrit `data/entries.json` et `data/glossary.json`. Les deux fichiers sont committés — le CI ne dépend jamais d'un accès réseau à ces dépôts externes.

L'extraction brute des 3 sources produit environ 21 500 entrées ; `build.ts` en tire un échantillon stratifié d'environ 400 (`TARGET_CORPUS_SIZE`), réparti aussi équitablement que possible entre chaque combinaison (projet, locale) présente dans les données brutes, pour respecter la cible de 300-500 entrées de la spec §5. Le glossaire (`glossary.json`), lui, reste dérivé du corpus brut complet — pas de l'échantillon — car `deriveGlossary` s'appuie sur un seuil d'occurrences (`MIN_OCCURRENCES`) qui est plus fiable sur davantage de données.

## Simplifications assumées (Sprint 0)

- Les entrées gettext avec `msgid_plural` sont ignorées (voir `adapters/gettext-locale.ts`) : la reconstruction ICU à partir de l'index `msgstr[n]` + l'expression `Plural-Forms` par locale est hors périmètre. Le checker de catégories de pluriel (`deterministic/plurals.ts`) est testé avec des fixtures ICU manuelles, pas avec ce corpus.
- `maxLength` est une heuristique (1,4 × la longueur de la chaîne source), pas une mesure de conteneur réelle — voir spec §3.
- Le glossaire est dérivé automatiquement à partir d'une liste de termes techniques/marque candidats, pas d'un glossaire officiel des projets sources.
