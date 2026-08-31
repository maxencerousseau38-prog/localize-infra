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
  auth bearer. **Plus « en local uniquement »** : déployé depuis le 2026-08-19,
  vérifié aujourd'hui — `/health` répond 200, `/v1/translate` répond 401 sans
  jeton.
- `services/github-app` (propriétaire) — ouverture de PR via Octokit.
- Validé de bout en bout **deux fois, et ce ne sont pas la même preuve.**
  Cette ligne portait la première : le CLI, contre un clone local. La seconde
  est le produit lui-même, le 2026-08-29 — depuis `/layersky/projects`, sans
  aucune intervention manuelle entre le bouton « Run pipeline » et la pull
  request. Run `b6fbbf11` : framework « Vite + React » détecté, 3 clés
  extraites, 12 traduites, 4 locales (`fr`, `de`, `ja`, `es`), 0 échec, PR #9
  ouverte sur `maxencerousseau38-prog/localize-infra-fixture-vite` en 22 s
  (21:32:30 → 21:32:52 UTC), fusionnée en squash le 2026-08-29 (`665b765`).
  C'est la seconde qui dit que le produit fonctionne ; la première ne disait
  que ça de la bibliothèque.

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
  un faux résultat, corrigé. **Ce point disait que le paquet n'était pas
  publié sur npm et que `npx` ne fonctionnait pas. Les trois moitiés sont
  périmées depuis le 2026-08-28** : `@localize-infra/schemas`, `core` et `cli`
  sont publiés en 0.1.0, `npx @localize-infra/cli init` détecte et extrait
  depuis un répertoire vide, et la page d'accueil affiche la commande au lieu
  de s'en excuser. `CLI_PUBLISHED_TO_NPM` porte ce fait à un seul endroit et
  les deux pages le lisent.

  Ce que `/docs` continue de dire, parce que c'est vrai : installer n'est pas
  pouvoir s'en servir. Le CLI pointe par défaut sur `http://localhost:8787` et
  l'API déployée n'est **pas ouverte** — toutes ses routes `/v1/*` exigent un
  bearer que seul l'opérateur détient. Trois phrases du site affirmaient à la
  place qu'il n'existait aucune API hébergée ; elles vivaient dans les branches
  « publié » du drapeau, donc personne ne les avait jamais vues à l'écran.

- `apps/web` (propriétaire) — coquille applicative : barre latérale 240 px
  (feuille latérale sous 1024 px), barre supérieure 48 px, palette de commandes
  ⌘K, et la galerie `/design` qui rend toute la bibliothèque de composants.
  **Ce point disait « six de ses sept routes déclarent qu'elles ne sont pas
  construites », et qu'un test e2e vérifiait que chacune le dit. Les deux sont
  périmés.** Il en reste **une**, `/[org]/billing`, et le test qui gardait la
  formule n'existe plus — il a été retiré avec les surfaces qu'il décrivait, au
  fil des PR #19 à #22, sans que ce paragraphe suive.

  `/runs`, `/runs/[id]`, `/locales`, `/ambiguity`, `/review`, `/[org]/projects`
  et `/[org]/projects/[project]` lisent Postgres sous RLS. Ce qu'ils affichent
  sans base configurée n'est pas un écran « non construit » mais un `NotConnected`
  qui dit qu'il n'y a pas de base à lire — délibérément pas un repli sur des
  données d'exemple, indiscernable d'un produit qui marche.

  La contrainte, elle, ne bouge pas : ne jamais remplacer un écran vide par des
  données inventées.

  **Un run qui ne trouve rien à traduire finit en `no_changes` et n'ouvre aucune
  PR.** Il ouvrait une pull request à zéro fichier modifié : les fichiers
  produits étaient identiques à la branche, donc l'arbre créé avait le SHA de
  base et le commit était vide. Deux de ces PR traînent encore sur le fixture,
  ouvertes en août. `catalogsEqual` (packages/core) compare les catalogues
  **parsés**, pas les octets — comparer le JSON sérialisé aurait remplacé la PR
  vide par une PR de reformatage à chaque run.

  **`packages/cli` et `apps/api` gardent le défaut.** Ils appellent
  `/v1/open-pr` sans comparer, donc un CLI lancé deux fois de suite produit
  toujours une PR vide. Le correctif durable serait côté API — comparer le SHA
  d'arbre obtenu à celui de la base après `createTree` — mais il exige de
  réordonner `open-pr.ts`, dont le `createRef` précède le `createTree`, et de
  changer le contrat de `/v1/open-pr`, donc `packages/schemas` et les deux
  appelants. Non fait, et su.

  **Et ce chemin n'a aucune couverture automatisée.** `run-actions.ts` n'a pas
  de fichier de test : c'est un server action à effets fs, réseau et Supabase.
  Extraire le calcul en fonction pure a été proposé puis écarté délibérément —
  `catalogsEqual` est déjà testé, et la composition extraite ne serait qu'un
  `||` entre deux appels couverts. Le risque réel n'est pas le calcul mais le
  **câblage** : quelles paires sont comparées. Une extraction ne le protège
  pas, et ce dépôt s'est déjà fait avoir exactement là — trois arguments
  positionnels inversés dans `canReachRepository`, que ni le compilateur ni un
  test n'ont vus. La seule vérification de ce chemin est donc manuelle, sur le
  fixture réel.

  CSP à nonce par requête (`src/proxy.ts`), à l'inverse d'`apps/site` : les deux
  configurations documentent leur arbitrage et pourquoi il ne se transpose pas.

**Cette liste énumérait comme inexistants : base de données, comptes,
organisations, équipes, permissions, facturation, projets persistants, tableau
de bord. Sept des huit existent aujourd'hui** — Postgres, l'authentification,
les organisations, l'appartenance et les rôles, les projets, les runs et les
surfaces qui les lisent. Voir les seize migrations et les PR #14 à #23.

**N'existe toujours pas** : la **facturation**. Aucune intégration Stripe dans
le dépôt, et `/[org]/billing` le dit — « Paid plans are not priced yet ». Ce
n'est pas un oubli mais une conséquence : `docs/product/08-critique.md` §C3
interdit de publier un prix avant d'avoir modélisé le coût unitaire, et ce
modèle n'a pas été fait. C'est donc lui, et non le code de paiement, qui est sur
le chemin critique du « vendable ».

Ne jamais simuler ces fonctionnalités dans l'interface.

Voir `docs/product/`, `docs/design/`, `docs/frontend/` (PRD → jalons), et
`docs/product/08-critique.md` pour ce qui n'est pas encore solide.

**`apps/site` est déployé** sur https://localize-infra-site.vercel.app (projet
Vercel `localize-infra-site`, compte `drive-os-s-projects`, suivi de `master`).

**`apps/web` est déployé** sur https://localize-infra-web.vercel.app (projet
Vercel `localize-infra-web`, même compte, Root Directory `apps/web`, fonctions
en `cdg1`).

**`apps/api` est déployé** sur https://localize-infra-api.vercel.app (projet
Vercel `localize-infra-api`, Root Directory `apps/api`, fonctions en `cdg1`).

**Et il n'est pas relié à Git, contrairement aux deux autres.** Fusionner sur
`master` déploie le site et le web, pas l'API : elle se déploie par
`npx vercel deploy --prod --archive=tgz` (voir `apps/api/DEPLOYING.md`). Le
piège est que les trois projets se ressemblent sur cette page alors que deux
seulement suivent `master` — un correctif à `apps/api` fusionné n'est pas un
correctif en ligne. Constaté le 2026-08-23 : la PR #33 fusionnée, la dernière
production de l'API datait encore de la veille.
Ce sont les **trois** projets Vercel du dépôt. `services/github-app` reste une
bibliothèque, consommée par `apps/api` ; elle n'a pas de déploiement propre.

**`apps/web` est relié à Git.** Ce paragraphe disait le contraire — « le
déploiement est une archive envoyée par la CLI depuis la racine du dépôt » — et
prévenait que relier le projet rendrait le réglage « Include source files
outside of the Root Directory » indispensable. C'est fait, et c'était la bonne
prédiction : fusionner une PR sur `master` déclenche un déploiement de
production, et une PR ouverte déclenche une preview avec son check GitHub.
Observé le 2026-08-23 sur la PR #31.

Le contrôle que ce paragraphe prescrivait a donc été rejoué, et il passe. Root
Directory est `apps/web`, et pourtant `bg-confident-bg` et
`text-ambiguous-text` — deux classes présentes dans `packages/ui/src` et
absentes d'`apps/web/src` — sont dans le CSS servi (184 611 octets sur deux
feuilles). Elles ne pourraient pas y être si la source hors Root Directory
n'était pas incluse : c'est une preuve par ce qui est servi, plus solide que la
lecture du réglage.

La conséquence pratique à retenir : **une modification de variable
d'environnement ne s'applique plus « au prochain déploiement CLI » mais à la
prochaine fusion.** Voir `apps/web/DEPLOYING.md` pour la commande CLI, qui
reste utilisable en secours.

**Ce paragraphe disait que seuls `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY`
étaient configurés, et que ni la clé privée de la GitHub App ni `LOCALIZE_API_*`
ne l'étaient. C'était faux depuis le 2026-08-19.** Vérifié par
`vercel env ls production` sur `prj_L5FZPh16GE88nLtgPbOnb2LR5e3f` : les
variables `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_ID`, `LOCALIZE_API_URL` et
`LOCALIZE_API_TOKEN` y sont. Le pipeline ne pointe donc plus sur
`127.0.0.1:8787` — c'est la conséquence du déploiement d'`apps/api` décrit plus
bas, et elle n'avait pas été reportée ici.

**Elles étaient neuf ; il en reste sept**, retirées le 2026-08-23 :
`GITHUB_OPERATOR_EMAILS` et `GITHUB_APP_INSTALLATION_ID`. Les sept qui restent
sont toutes lues par du code non-test d'`apps/web` — vérifié variable par
variable, c'est ce qui rend le nettoyage terminé plutôt qu'entamé.

Ce paragraphe disait que les deux « ne sont plus lues par rien ». C'était vrai
de la première et **faux de la seconde** : `apps/api/src/index.ts` la lit à
chaque démarrage, et `/v1/open-pr` ouvre toutes ses PR à travers elle. Elles
étaient mortes *dans le projet web*, ce qui n'est pas la même affirmation.
Retirer `GITHUB_APP_INSTALLATION_ID` du projet **API** couperait l'ouverture de
PR — `readGitHubAppConfig` renvoie `null` sans elle et la route répond 501.

La suppression ne prend effet qu'au déploiement suivant — et comme le projet est
relié à Git (voir plus haut), c'est la fusion de la PR #31 qui l'a produit.
Vérifié sur le déploiement qui en résulte : `/login` répond 200 et le CSS servi
est identique à l'octet près (184 611), donc retirer ces deux variables n'a rien
changé pour l'application. C'est la seule preuve qui compte, l'absence
d'appelant n'étant qu'un argument.

**Ce paragraphe disait que `GITHUB_OAUTH_CLIENT_ID` et
`GITHUB_OAUTH_CLIENT_SECRET` manquaient tous les deux. Le premier est configuré
depuis le 2026-08-23**, obtenu par `GET /app` authentifié comme l'App avec la
clé privée déjà présente dans `.env` : le `client_id` est public par
construction, il figure dans toute URL d'autorisation.

**Le secret, lui, n'était récupérable par aucune API** — GitHub ne l'affiche
qu'une fois, à la génération, dans les réglages de l'App. C'est cette asymétrie,
et non un oubli, qui a fait que la moitié de ce blocage était automatisable et
l'autre non.

**Il a été posé à la main le 2026-08-28, et ce blocage est tombé.** Ce passage
disait « le flux reste donc coupé et continue de le dire » ; ce n'est plus vrai.
`GITHUB_OAUTH_CLIENT_SECRET` est configuré sur le projet Vercel, donc
`readOAuthConfig()` renvoie la paire et `canInstall` est vrai.

La preuve n'est pas le réglage mais son résultat :
`organization_github_installations` porte l'installation `151289538`
(`maxencerousseau38-prog`, compte utilisateur) pour `layersky`, connectée le
2026-08-28 à 12:26 **par le flux OAuth de l'interface** — le seul chemin qui
exige le secret, puisque c'est lui qui échange le `code` puis vérifie
l'installation contre le jeton de l'utilisateur. Une ligne posée en SQL aurait
exactement la même apparence en base ; c'est le propriétaire qui a confirmé le
chemin emprunté, et c'est pour ça que la question a été posée plutôt que
déduite.

Les deux réglages de l'App restent ni modifiables ni **lisibles** par API :
« Request user authorization (OAuth) during installation », et l'URL de callback
`https://localize-infra-web.vercel.app/github/callback`. Sonder
`login/oauth/authorize` ne les révèle toujours pas — GitHub redirige vers sa
page de connexion avant de valider `redirect_uri`, donc une URL enregistrée et
une URL inconnue répondent à l'identique. Mais ils sont désormais **constatés
corrects** au lieu d'être supposés : un flux qui va jusqu'à écrire la ligne
prouve les deux. C'est la preuve que le sondage ne pouvait pas donner.

**`apps/web/DEPLOYING.md` n'avait pas suivi** — son tableau portait encore
`GITHUB_OAUTH_CLIENT_SECRET` en « no » et la phrase « The one thing still
blocking self-serve ». Corrigé dans le même commit que ce paragraphe, pour que
les deux fichiers ne puissent pas diverger d'une PR.

**Deux projets Supabase, séparés depuis le 2026-08-17.** Développement et
tests d'acceptation : `localize-infra` (`aguwalokxfgtqbzmdjbs`). Production :
`localize-infra-prod` (`ijgheekdihgssktyweyy`). Les deux en `eu-west-3`.

**Ce compte a été faux deux fois, et « appliquées de part et d'autre » l'était
aussi.** Il a dit « seize », puis « vingt-neuf ». Au 2026-08-30 : trente
fichiers dans `supabase/migrations`, trente lignes appliquées en production, et
**trente-deux** en développement.

Les deux surnuméraires ne sont pas un retard de la production. Ce sont deux
correctifs appliqués en développement puis repliés dans la version finale avant
qu'elle n'atteigne la production — `project_target_locales_per_element_shape`
et `closer_sent_respects_optout_restore`. Le premier est celui que le
commentaire de `20260829000100` raconte : une contrainte qui acceptait
l'élément unique `'fr,de'`, prise en insérant la valeur et non en relisant
l'expression.

D'où la règle à retenir plutôt que le nombre : **compter les lignes des deux
côtés ne prouve pas l'égalité des schémas**, puisque les historiques divergent
légitimement. Ce qui la prouve est de comparer les objets. Vérifié le
2026-08-30 sur `projects` : `root_dir`,
`projects_root_dir_is_a_safe_subdirectory` et
`projects_target_locales_are_valid` sont bien présents en production.

**Ces deux projets n'en formaient qu'un**, et ce n'était pas un détail : le
compte semé par `supabase/seeds/dev-user.sql` — mot de passe écrit dans ce dépôt, fichier qui
précise « NOT for production » — s'authentifiait contre le déploiement public.
Vérifié, puis re-vérifié après la bascule : le même appel renvoie désormais
`Invalid login credentials`.

**Cette phrase ajoutait « La base de production ne contient aucun compte ».
Ce n'est plus vrai :** la base contient un compte, créé le 2026-08-18, qui a
créé l'organisation `layersky`. Ce n'est pas le compte semé, qui reste refusé.

**Ce paragraphe a affirmé qu'il s'agissait d'un « compte tiers réel » et que
c'était « la donnée la plus utile que ce dépôt possède ». C'était faux.** Le
compte appartient au propriétaire — confirmé par lui le 2026-08-23, et
recoupé par le fait que `npm whoami` renvoie `layersky`. Il avait été lu comme
une inscription indépendante parce que l'adresse est sur un autre domaine que
celui habituel du propriétaire : une déduction à partir d'un domaine e-mail,
écrite comme un fait sur un inconnu, sans rien vérifier.

**Ce paragraphe décrivait ensuite un tunnel qui se termine en cul-de-sac** —
un workspace arrivant sur `/layersky/projects` et lisant que connecter GitHub
n'est pas disponible sur ce déploiement, avec pour seule porte de sortie « le
CLI fonctionne toujours sur un clone local ». C'était vrai, et ça ne l'est plus
depuis le 2026-08-28 : le secret OAuth est posé, le bouton s'affiche, et le
tunnel a été parcouru en entier le 2026-08-29 — connexion GitHub, projet,
langues cibles, run, pull request fusionnée.

**Ce passage nommait deux bloquants : le secret OAuth et la publication du
paquet. Les deux sont tombés le 2026-08-28.** Le CLI est sur npm, donc la porte
de sortie n'exige plus de cloner quoi que ce soit pour obtenir la commande —
elle reste étroite, traduire demandant une API que le lecteur héberge lui-même.
Et le secret OAuth est configuré, donc un workspace peut connecter sa propre
installation depuis l'interface au lieu de lire qu'il ne peut pas.

**Ce qui reste sur le chemin du « vendable » n'est donc plus technique.** Le
parcours complet — inscription, connexion GitHub, projet, langues, run, pull
request — est franchissable depuis l'interface pour un dépôt **public**.

Deux réserves, et ce sont des faits, pas des nuances. Un dépôt **privé** exige
encore `organization_entitlements.private_repositories`, qui n'a aucun chemin
produit et se pose à la main : c'est ainsi que `layersky` a pu viser le fixture,
qui est privé — accordé le 2026-08-28, `plan` laissé à `free`, aucune
facturation derrière, et le `granted_reason` de la ligne le dit. Et personne ne
peut payer, ce qui est le sujet du paragraphe sur la facturation plus haut.

**Il n'existe toujours aucune preuve que quiconque hors de ce projet le
veuille.** `docs/product/08-critique.md` §C1 — zéro recherche primaire, personas
inventés — reste entièrement valable.

La phrase « NOT for production » n'empêchait rien, donc la règle est maintenant
appliquée et non plus écrite. La base de production porte une marque posée hors
migration — `comment on database postgres is 'localize-infra-production'` ;
hors migration parce qu'une migration se rejoue aussi en développement et ne
distinguerait donc pas les deux. Le seed lit cette marque et refuse de
s'exécuter. Testé dans les deux sens : il lève une exception sur la production,
il passe sur le développement.

Le troisième emplacement de projet a été libéré en **suspendant** le projet
ReFrame (`ngbxfpsfmjagauavbuhd`, vide — 0 ligne sur ses six tables). C'est
réversible par `restore_project` ; si ReFrame en a de nouveau besoin, il faudra
arbitrer l'emplacement.

**Écart connu — mots de passe compromis.** La protection contre les mots de
passe fuités (corpus HaveIBeenPwned) est réservée au plan Pro de Supabase, et
l'organisation est en plan gratuit : elle **n'est pas activable**, ce n'est pas
un oubli. Le remplacement est plus faible et vit dans
`packages/schemas/src/password.ts` : minimum de 12 caractères, refus au-delà de
72 octets (bcrypt tronque en silence au-delà), refus d'un mot de passe qui
contient l'adresse e-mail. Pas de règles de composition — NIST SP 800-63B ne les
recommande plus, elles produisent `Password1!`. Un mot de passe de 12 caractères
présent dans un corpus de fuite passe donc encore ; seul le plan Pro corrige ça.

La règle ne s'applique qu'à la **création de compte**. L'imposer à la connexion
enfermerait dehors les comptes antérieurs — un test e2e garde ce point, parce
que le champ mot de passe est partagé par les deux boutons et qu'un `minLength`
sur cet input aurait exactement cet effet.

Cette phrase a déjà été fausse, et pas qu'un peu : un projet
`localize-infra-api` a existé sur le même compte et redéployait `apps/api` à
chaque push pendant que ce fichier affirmait « reste local ». Il répondait 500
sur toutes les routes — `API_AUTH_TOKEN` absent côté Vercel, et
`apps/api/src/index.ts` refuse de démarrer sans lui : le fail-closed voulu, qui
a transformé l'oubli en URL publique morte plutôt qu'en API ouverte. Projet
supprimé le 2026-08-14.

**C'est arrivé, le 2026-08-19, sur décision explicite.** Ce paragraphe disait
que redéployer `apps/api` « n'est pas un geste neutre » et que, le cas échéant,
il se mettrait à jour dans le même commit. Voici cette mise à jour.

L'écart connu à l'invariant 5 n'est donc plus sur le poste du développeur : le
service tourne sur une URL publique et envoie du contexte extrait du code source
— chemins de fichiers, noms de composants, code environnant — à Anthropic, hors
UE, à chaque traduction. Les fonctions sont en `cdg1` et la base est en
`eu-west-3`, ce qui règle le trajet jusqu'au modèle, pas le modèle lui-même.
`apps/api/public/index.html` le dit aussi à qui visite la racine du service.

Ce qui rend le déploiement tenable plutôt qu'imprudent, c'est le fail-closed :
`apps/api/src/index.ts` refuse de démarrer sans `API_AUTH_TOKEN`, toutes les
routes `/v1/*` exigent le bearer (vérifié en production : 401 sans jeton, 401
avec un mauvais jeton), et `/health` est la seule route publique. Les cinq
variables sont cette fois configurées — l'oubli de 2026-08-14 est précisément
ce que cette liste empêche de répéter.

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
premier coup d'œil. `docs/releasing.md` couvre la publication npm — il disait
« rien n'est publié », les trois paquets le sont depuis le 2026-08-28.

M1 Phase 1 (`packages/core`, `packages/cli`) — voir
`docs/superpowers/specs/2026-08-02-m1-npx-to-pr-design.md` et
`docs/superpowers/plans/2026-08-02-m1-phase1-core-cli.md`.

M1 Phase 2 (`apps/api`, `services/github-app`) — **la GitHub App existe et
fonctionne.** Ce paragraphe a longtemps dit « en attente de la GitHub App créée
par un humain (Task 6) » ; c'était faux. Les identifiants sont dans `.env`
(gitignoré) et l'installation atteint deux dépôts, vérifié :
`maxencerousseau38-prog/localize-infra` et
`maxencerousseau38-prog/localize-infra-fixture-vite` — ce dernier étant
exactement le dépôt de la PR réelle affichée sur la landing.

**L'installation est stockée par organisation, plus par déploiement.** Ce
paragraphe décrivait une installation unique partagée, et disait que la
connexion d'un dépôt était « réservée aux opérateurs (`GITHUB_OPERATOR_EMAILS`) ».
Les deux moitiés étaient fausses au moment où elles ont été écrites.

`organization_github_installations` porte l'`installation_id` par organisation
depuis la migration `…0817000600`, et `resolveInstallation` ne sait plus rien
dire d'autre : le type ne peut plus exprimer « agir comme l'installation
partagée ». Un workspace sans installation propre n'a donc pas d'accès GitHub —
ce n'est pas un cas qui échoue proprement, c'est un cas qui ne compile pas.

Quant au garde-fou : `isOperator` et `operatorInstallationId` **n'avaient aucun
appelant**, ni l'un ni l'autre, alors que trois commentaires affirmaient que
tout appelant vérifiait le premier. Ce n'était pas une faille — le chemin qu'ils
gardaient était inatteignable — mais une liste blanche qui n'appliquait rien,
décrite à trois endroits comme ce qui séparait les locataires. Les deux sont
supprimés ; l'isolation était structurelle et l'est maintenant explicitement.

**L'écriture emprunte désormais la même installation que la lecture.** Ce
paragraphe disait « sur le chemin de lecture seulement », et c'était exact :
la PR n'est pas ouverte par `apps/web` mais par `apps/api`, qui n'acceptait
**aucun** `installation_id` et sortait donc *toutes* les PR de *tous* les
locataires par l'installation unique de l'opérateur. Un client ayant connecté la
sienne aurait traduit puis échoué au dernier pas — celui qui est le premier
livrable (invariant 2).

Corrigé : `/v1/open-pr` accepte un `installationId` optionnel et agit comme lui ;
les deux appelants d'`apps/web` résolvent l'installation du workspace et
l'envoient. `GITHUB_APP_INSTALLATION_ID` cesse d'être *l'*installation pour
devenir un **défaut**, ce qui garde `packages/cli` fonctionnel contre un
`apps/api` auto-hébergé. `GitHubAppConfig` a été scindé en identifiants et
installation — le même découpage qu'`apps/web` a fait en #24, pour la même
raison : fusionner « ce qu'est l'App » et « quelle installation » est ce qui ne
laissait aucune place au choix.

Ce qui reste, et qui est une garantie portée par le client et non par le
service : `apps/api` authentifie un jeton, pas un workspace, donc il ne peut pas
vérifier que l'installation nommée appartient à l'appelant. `apps/web` la dérive
de l'organisation et détient seul `LOCALIZE_API_TOKEN`. Le garde-fou de dernier
recours est celui de GitHub — un jeton d'installation n'atteint que ce que cette
installation s'est vu accorder.

Il ne manque donc plus qu'une chose côté GitHub pour le multi-locataire :
**le secret OAuth**, sans lequel aucun client ne peut déclencher sa propre
installation — et le bouton est absent plutôt que désactivé.

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

Propriétaires (tous droits réservés) : `packages/pricing`, `packages/ui`,
`apps/api`, `apps/site`, `apps/web`, `services/github-app`. Chacun porte un avis explicite, pour qu'on ne
puisse pas supposer que le MIT de la racine s'applique en parcourant un dossier.

**Tout ajout est propriétaire par défaut**, sauf s'il est placé dans l'un des
chemins ouverts ci-dessus ou que `LICENSE` est amendé. `adapters` et `sdk-*`
sont prévus comme ouverts mais n'existent pas encore.

Le cœur ouvert doit être utilisable seul.

## Tests obligatoires en CI
Intégrité placeholders/ICU ≥ 99,5 % (packages/eval, condition B).
Harnais d'éval rejoué à chaque changement de modèle ou de prompt.

## Les gates — `npm run gates`

**Une seule commande, dans cet ordre : lint → typecheck → test → test:e2e.**
Lancer les quatre. Pas trois.

Ce script existe parce que la mémoire ne suffit pas : une session entière a
tourné en lançant lint, typecheck et les deux suites e2e après chaque
changement, sans jamais rejouer les tests unitaires. Un test de `packages/ui`
est resté rouge pendant deux commits.

Deux pièges rendent un gate vert alors qu'il ne l'est pas. Les deux ont
frappé, les deux sont désormais corrigés à la cause — mais il faut savoir
qu'ils existent, parce que leur symptôme est **un succès**, jamais une erreur.

1. **Le cache turbo.** `type-scale.test.ts` (packages/ui) lit `apps/site/src`
   et `apps/web/src`, alors que la clé de cache par défaut ne couvre que
   `packages/ui`. Une violation commise dans une app ne déplaçait pas la clé et
   turbo rejouait le dernier succès. Corrigé par `packages/ui/turbo.json`, qui
   déclare ces répertoires en `inputs`. En cas de doute : `--force`.
2. **Un serveur resté vivant.** Les deux configs Playwright ont
   `reuseExistingServer` hors CI, donc un `next start` oublié répond encore —
   et si un build a réécrit `.next` sous lui, la suite échoue partout pour des
   raisons sans rapport avec le diff, ou pire, passe sur du code qui n'est plus
   là. Tuer les ports 3210/3211 avant une campagne e2e.

CI (`.github/workflows/ci.yml`) fait tourner les mêmes gates, avec `npm ci`
dans les deux jobs.

**`package-lock.json` doit être généré sous Linux.** C'est la seule contrainte
non évidente de ce dépôt côté dépendances, et elle a coûté cinq jours de CI
rouge : npm élague les paquets optionnels de plateforme qui ne correspondent
pas à la machine qui écrit le lockfile (npm/cli#4828). Généré sous Windows, il
ne contenait que `@rollup/rollup-win32-*` et `@esbuild/win32-x64` ; `npm ci`
sous Linux installait donc un arbre sans binaire rollup, et vitest mourait
avant sa première assertion. Le job `e2e` passait pendant tout ce temps — Next
compile avec swc, présent en Linux dans le lockfile — d'où un badge vert à côté
d'un badge rouge, que personne n'a lu.

L'asymétrie n'est pas réciproque, et c'est ce qui rend la règle utilisable : un
lockfile écrit sous **Linux** contient la matrice complète des deux
chaînes — win32 compris — donc il s'installe sur les deux plateformes. Vérifié
par sonde avant adoption, puis par un `npm ci` réel sous Windows.

Deux impasses, pour ne pas les refaire :

- `npm install --package-lock-only` sur un lockfile existant **n'ajoute pas**
  les entrées manquantes, sous Linux comme sous Windows ;
- `--os=linux --cpu=x64` ne produit aucun diff.

Seule une régénération complète fonctionne, et elle **re-résout les versions**
dans les plages de `package.json`. Celle-ci en a déplacé 77, dont
`@hono/node-server` 1.19.17 → 2.1.1 (majeure). Les gates passent, mais si un
jour vous régénérez : lisez le diff, il n'est jamais uniquement plateforme.

### Protection de branche

`master` exige les deux checks — `test` **et** `e2e` — avant qu'une pull
request puisse être fusionnée. Force-push et suppression de la branche sont
bloqués.

Le pourquoi : pendant cinq jours le badge `e2e` est resté vert à côté d'un
badge `test` rouge, et personne ne l'a lu. Le signal existait ; ce qui manquait
était l'obligation de le regarder. Exiger les deux, et pas seulement l'un,
c'est précisément ce qui empêche qu'une moitié verte serve d'alibi à l'autre.

**`enforce_admins` est à `true`.** La règle s'applique au propriétaire comme à
tout le monde : **`git push origin master` est refusé**, y compris pour un
admin. Tout passe désormais par une branche et une pull request. Tout
l'historique du dépôt jusqu'à `4ece793` a été poussé en direct ; ce n'est plus
possible.

Le flux :

```
git switch -c <branche>
git push -u origin <branche>
gh pr create --fill
gh pr checks --watch      # test + e2e doivent passer
gh pr merge --squash --delete-branch
```

**Le piège à connaître, parce qu'il s'est déjà produit ici :** si CI casse pour
une raison d'infrastructure — c'est arrivé cinq jours durant, le job `test` ne
démarrait même pas — alors *plus rien ne peut être fusionné*, y compris le
correctif de CI lui-même. La sortie est de désactiver temporairement la
contrainte, fusionner le correctif, la remettre :

```
gh api -X DELETE repos/.../branches/master/protection/enforce_admins
gh api -X POST   repos/.../branches/master/protection/enforce_admins
```

`strict` est à `false` : une branche n'a pas besoin d'être à jour avec `master`
avant fusion. Sur un dépôt à un seul auteur, l'exiger ne force que des rebases.

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