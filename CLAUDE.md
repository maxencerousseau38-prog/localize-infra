# Projet — infrastructure de localisation développeur-first

## Invariants (ne jamais violer sans validation explicite)
1. Git est la source de vérité. Postgres = index/cache.
2. Premier livrable = pull request, jamais dashboard.
3. Aucune facturation au mot/caractère/relecteur. Abonnement fixe uniquement.
4. L'agent remonte les ambiguïtés, il ne les devine pas.
5. Résidence des données UE.

## État actuel
Seul `packages/eval` (harnais d'évaluation, Sprint 0) et `packages/schemas`
existent pour l'instant. Voir `docs/superpowers/specs/2026-07-30-eval-harness-design.md`.

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
Ouverts : cli, core, adapters, sdk-*, schemas, eval.
Propriétaires : context, agents, api, web.
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