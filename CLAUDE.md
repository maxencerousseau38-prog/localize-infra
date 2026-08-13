# Projet — infrastructure de localisation développeur-first

## Invariants (ne jamais violer sans validation explicite)
1. Git est la source de vérité. Postgres = index/cache.
2. Premier livrable = pull request, jamais dashboard.
3. Aucune facturation au mot/caractère/relecteur. Abonnement fixe uniquement.
4. L'agent remonte les ambiguïtés, il ne les devine pas.
5. Résidence des données UE.

## État actuel

**Backend (fonctionne aujourd'hui)**
- `packages/eval` — harnais d'évaluation (Sprint 0). Corpus de 414 chaînes,
  contrôles déterministes placeholders/ICU/pluriels en CI.
- `packages/schemas` — contrats Zod partagés (CLI, API, web).
- `packages/core` + `packages/cli` — détection de framework, extraction AST,
  moteur de fusion des fichiers de locale, commande `init` (M1 Phase 1).
- `apps/api` (propriétaire) — `POST /v1/translate`, `POST /v1/open-pr`,
  auth bearer, en local uniquement.
- `services/github-app` (propriétaire) — ouverture de PR via Octokit.
- Validé de bout en bout : une vraie PR ouverte en 22 s sur un dépôt réel.

**Frontend**
- `packages/ui` (propriétaire) — tokens de design en 3 couches, primitives.
  Livré en **source**, pas en `dist` : un artefact compilé partagé entre
  paquets a déjà causé un bug de production ici (correctif de sécurité présent
  en source mais absent du build servi).
- `apps/site` (propriétaire) — site marketing statique, 7 pages.
  Contrainte permanente : **toute affirmation du site doit être vraie
  aujourd'hui.** `/quality` ne publie que les résultats vérifiés en CI et
  déclare que l'évaluation humaine n'a pas eu lieu ; `/pricing` ne publie pas
  de tarifs non modélisés ; `/security` divulgue l'écart de résidence UE.

  `/benchmarks` et `/quality` ne contiennent **aucun chiffre écrit à la main** :
  tout provient de `packages/eval/src/report/benchmarks.json`, généré depuis le
  corpus par `npm run benchmarks:build -w @localize-infra/eval`, et un test
  vérifie que le fichier commité correspond au générateur. Un contrôle sans
  entrée applicable affiche « No data », jamais un pourcentage — le corpus ne
  contient aucun message ICU, et afficher « Pass » pour ces deux contrôles était
  un faux résultat, corrigé. `/docs` documente le chemin réel : le paquet
  **n'est pas publié sur npm**, donc `npx` ne fonctionne pas ; la page d'accueil
  le dit désormais au lieu de laisser une commande qui échoue.

- `apps/web` (propriétaire) — coquille applicative : barre latérale 240 px
  (feuille latérale sous 1024 px), barre supérieure 48 px, palette de commandes
  ⌘K, et la galerie `/design` qui rend toute la bibliothèque de composants.
  **Six de ses sept routes déclarent qu'elles ne sont pas construites**, faute
  de backend ; un test e2e vérifie que chacune le dit. Ne jamais remplacer ces
  écrans par des données inventées — c'est la contrainte, pas un provisoire.
  CSP à nonce par requête (`src/proxy.ts`), à l'inverse d'`apps/site` : les deux
  configurations documentent leur arbitrage et pourquoi il ne se transpose pas.

**N'existe pas encore** : base de données, comptes, organisations, équipes,
permissions, facturation, projets persistants, tableau de bord.
Ne jamais simuler ces fonctionnalités dans l'interface.

Voir `docs/product/`, `docs/design/`, `docs/frontend/` (PRD → jalons), et
`docs/product/08-critique.md` pour ce qui n'est pas encore solide.

**`apps/site` est déployé** sur https://localize-infra-site.vercel.app (projet
Vercel `localize-infra-site`, suivi de `master`). Rien d'autre ne l'est :
`apps/web`, `apps/api` et `services/github-app` restent locaux.

Aucun domaine personnalisé n'est attaché. `SITE_URL`
(`apps/site/src/lib/routes.ts`) porte cette origine, et tout ce que le site
déclare sur lui-même en découle — canonique, `metadataBase`, sitemap, robots.
Y attacher un domaine, c'est changer cette seule ligne : la laisser périmée est
exactement ce qui a fait pointer la canonique de chaque page vers
`localize-infra.dev`, un domaine jamais enregistré, pendant tout le premier
déploiement.

`docs/deploying.md` donne les réglages Vercel et le
piège qui casse le site en silence : sans « Include source files outside of the
Root Directory », la directive `@source` de Tailwind ne trouve plus
`packages/ui/src`. Le build passe au vert et **30 % de la feuille de style
disparaît** (44,4 ko → 30,9 ko, mesuré) : les composants partagés perdent leurs
utilitaires alors que la mise en page tient encore — donc ça ne se voit pas au
premier coup d'œil. `docs/releasing.md` couvre la publication npm (rien n'est
publié).

M1 Phase 1 (`packages/core`, `packages/cli`) — voir
`docs/superpowers/specs/2026-08-02-m1-npx-to-pr-design.md` et
`docs/superpowers/plans/2026-08-02-m1-phase1-core-cli.md`.

M1 Phase 2 (`apps/api`, `services/github-app`) — **en attente de la GitHub App
créée par un humain** (Task 6, voir
`docs/superpowers/plans/2026-08-02-m1-phase2-api-github-app.md`) avant un
premier run bout-en-bout réel contre un vrai repo.

**Écart connu à l'invariant 5 (résidence des données UE) :** cette phase
envoie du contexte extrait du code source (chemins de fichiers, noms de
composants, code environnant) à des fournisseurs LLM non hébergés dans l'UE
(Anthropic, OpenAI) pour la traduction — voir `packages/cli/README.md`. Il
s'agit d'un compromis délibéré et documenté pour ce jalon pré-alpha, pas
encore résolu, et à traiter quand la résidence des données UE sera
réellement adressée.

## Avant toute UI
Charger /mnt/skills/public/frontend-design/SKILL.md.
Produire le plan de design (palette, typo, layout, signature) AVANT le CSS.
Éviter les défauts IA identifiés dans le skill, notamment l'accent #D97757.

## MCP
Supabase : migrations, types, RLS (get_advisors systématique). Jamais les traductions.
Vercel : deploy, build logs, runtime errors.
Stripe : prix récurrents fixes uniquement. Jamais `metered`.
21st : primitives dashboard. Figma : seulement si design system existant.

## Open source
**Le fichier `LICENSE` à la racine fait foi** : il délimite explicitement les
deux licences et énumère les chemins réels. Ne pas laisser cette section diverger.

Ouverts (MIT) : `packages/cli`, `packages/core`, `packages/eval`,
`packages/schemas`. Chacun porte sa propre copie du texte MIT, pour que la
licence voyage avec le code publié ou copié.

Propriétaires (tous droits réservés) : `packages/ui`, `apps/api`, `apps/site`,
`apps/web`, `services/github-app`. Chacun porte un avis explicite, pour qu'on ne
puisse pas supposer que le MIT de la racine s'applique en parcourant un dossier.

**Tout ajout est propriétaire par défaut**, sauf s'il est placé dans l'un des
chemins ouverts ci-dessus ou que `LICENSE` est amendé. `adapters` et `sdk-*`
sont prévus comme ouverts mais n'existent pas encore.

Le cœur ouvert doit être utilisable seul.

## Tests obligatoires en CI
Intégrité placeholders/ICU ≥ 99,5 % (packages/eval, condition B).
Harnais d'éval rejoué à chaque changement de modèle ou de prompt.

## Frontend defaults

For every website, landing page, dashboard, marketing page, or React/Next.js frontend:

- Always use Lenis as the default smooth scrolling library unless I explicitly request another solution.
- Use the official Lenis React integration.
- Respect `prefers-reduced-motion`.
- Ensure compatibility with Framer Motion.
- Prioritize smoothness, accessibility, and performance.
- Never implement custom smooth scrolling when Lenis can solve it.
- Centralize Lenis configuration in a reusable provider/component.
- Optimize Lenis usage for performance, 120Hz+ displays, and mobile devices.
- Integrate Lenis carefully with Framer Motion and scroll-based animations.
- Disable or reduce non-essential smooth scrolling effects when `prefers-reduced-motion` is enabled.

- Use GSAP for complex, timeline-based, or high-performance animations when CSS animations or Framer Motion are not sufficient.
- Use the official GSAP package and recommended integration patterns.
- Ensure compatibility with React/Next.js projects.
- Prefer GSAP timelines for complex sequences and coordinated animations.
- Use performant transforms and opacity animations whenever possible.
- Avoid unnecessary animations that impact performance or usability.
- Respect `prefers-reduced-motion` for non-essential animations.

- Use React Bits components and patterns when a premium React UI effect, animation, interaction, or visual component already exists.
- Prefer React Bits over creating custom animated components from scratch when appropriate.
- Adapt React Bits components to the project's design system instead of copying styles blindly.
- Ensure React Bits components remain performant, accessible, and compatible with Next.js App Router.
- Combine React Bits with Lenis, GSAP, and Framer Motion when creating premium interactive experiences.